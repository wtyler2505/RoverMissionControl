/**
 * Enhanced Progress Tracking Service
 * 
 * Provides granular progress tracking, real-time updates, performance monitoring,
 * and analytics for the rover command system.
 */

import { BehaviorSubject, Observable, Subject, interval, merge } from 'rxjs';
import { filter, map, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { 
  EnhancedProgress, 
  ProgressStep, 
  ProgressUpdateEvent,
  ProgressNotification,
  CommandPerformanceMetrics,
  PerformanceAnalytics,
  ProgressHistoryEntry,
  Alert,
  AlertRule,
  ProgressTrackingConfig,
  ProgressTrackingEvent,
  calculateEstimatedCompletion
} from '../types/progress-tracking.types';
import { 
  Command, 
  CommandStatus,
  CommandEventType,
  AcknowledgmentProgress 
} from '../../../shared/types/command-queue.types';
import { getAcknowledgmentService } from './acknowledgment.service';
import { WebSocketClient } from './websocket/WebSocketClient.enhanced';

export class ProgressTrackingService {
  private static instance: ProgressTrackingService;
  
  // Observables
  private progressSubject = new BehaviorSubject<Map<string, EnhancedProgress>>(new Map());
  private notificationSubject = new Subject<ProgressNotification>();
  private alertSubject = new Subject<Alert>();
  private metricsSubject = new Subject<CommandPerformanceMetrics>();
  private analyticsSubject = new BehaviorSubject<PerformanceAnalytics | null>(null);
  
  // Internal state
  private progressMap = new Map<string, EnhancedProgress>();
  private historyMap = new Map<string, ProgressHistoryEntry[]>();
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private performanceBuffer: CommandPerformanceMetrics[] = [];
  
  // Services
  private acknowledgmentService = getAcknowledgmentService();
  private wsClient: WebSocketClient;
  
  // Configuration
  private config: ProgressTrackingConfig = {
    enableGranularTracking: true,
    trackingGranularity: 'high',
    updateInterval: 100, // 100ms for high-frequency updates
    enableNotifications: true,
    notificationThreshold: {
      error: true,
      warning: true,
      info: false,
      success: true
    },
    enablePerformanceMetrics: true,
    metricsRetentionPeriod: 86400000, // 24 hours
    enableAlerts: true,
    alertCheckInterval: 5000, // 5 seconds
    enableHistory: true,
    historyRetentionPeriod: 604800000, // 7 days
    maxHistoryEntries: 1000,
    enableReplay: true,
    replaySpeed: 1
  };
  
  // Intervals
  private updateInterval?: NodeJS.Timeout;
  private alertInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private destroy$ = new Subject<void>();

  private constructor() {
    this.wsClient = WebSocketClient.getInstance();
    this.initialize();
  }

  static getInstance(): ProgressTrackingService {
    if (!ProgressTrackingService.instance) {
      ProgressTrackingService.instance = new ProgressTrackingService();
    }
    return ProgressTrackingService.instance;
  }

  private async initialize(): Promise<void> {
    // Subscribe to acknowledgment service updates
    this.acknowledgmentService.getAllAcknowledgments$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(acknowledgments => {
        acknowledgments.forEach((ack, commandId) => {
          this.updateProgressFromAcknowledgment(commandId, ack);
        });
      });

    // Subscribe to WebSocket events
    this.setupWebSocketHandlers();

    // Start intervals
    if (this.config.enablePerformanceMetrics) {
      this.updateInterval = setInterval(() => {
        this.calculateAnalytics();
      }, this.config.updateInterval);
    }

    if (this.config.enableAlerts) {
      this.alertInterval = setInterval(() => {
        this.checkAlerts();
      }, this.config.alertCheckInterval);
    }

    // Cleanup old data periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  /**
   * Track a command with enhanced progress monitoring
   */
  async trackCommand(command: Command, steps?: ProgressStep[]): Promise<void> {
    const defaultSteps = this.generateDefaultSteps(command);
    const progress: EnhancedProgress = {
      commandId: command.id,
      trackingId: `track_${command.id}_${Date.now()}`,
      overallProgress: 0,
      steps: steps || defaultSteps,
      startedAt: new Date(),
      isStalled: false,
      throughput: 0,
      errorRate: 0,
      retryCount: 0,
      lastUpdatedAt: new Date(),
      updateFrequency: 0
    };

    this.progressMap.set(command.id, progress);
    this.emitProgressUpdate(progress);

    // Also track in acknowledgment service
    await this.acknowledgmentService.trackCommand(command.id);
  }

  /**
   * Update progress for a specific step
   */
  updateStepProgress(
    commandId: string, 
    stepId: string, 
    progress: number, 
    status?: ProgressStep['status'],
    message?: string
  ): void {
    const enhancedProgress = this.progressMap.get(commandId);
    if (!enhancedProgress) return;

    const step = this.findStep(enhancedProgress.steps, stepId);
    if (!step) return;

    // Update step
    step.progress = Math.max(0, Math.min(1, progress));
    if (status) {
      step.status = status;
      if (status === 'active' && !step.startedAt) {
        step.startedAt = new Date();
      } else if ((status === 'completed' || status === 'error') && !step.completedAt) {
        step.completedAt = new Date();
        if (step.startedAt) {
          step.duration = step.completedAt.getTime() - step.startedAt.getTime();
        }
      }
    }

    // Recalculate overall progress
    enhancedProgress.overallProgress = this.calculateOverallProgress(enhancedProgress.steps);
    enhancedProgress.lastUpdatedAt = new Date();
    
    // Calculate estimated completion
    if (enhancedProgress.overallProgress > 0 && enhancedProgress.overallProgress < 1) {
      enhancedProgress.estimatedCompletionTime = calculateEstimatedCompletion(
        enhancedProgress.overallProgress,
        enhancedProgress.startedAt
      );
    }

    // Check for stalls
    this.checkForStalls(enhancedProgress);

    // Emit update event
    const event: ProgressUpdateEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commandId,
      timestamp: new Date(),
      updateType: status === 'completed' ? 'step_completed' : 
                  status === 'active' ? 'step_started' : 'progress_update',
      stepId,
      progress: step.progress,
      message
    };

    this.emitProgressUpdate(enhancedProgress, event);

    // Create notification if needed
    if (status === 'error' && this.config.notificationThreshold.error) {
      this.createNotification({
        commandId,
        type: 'error',
        severity: 'high',
        title: `Error in ${step.name}`,
        message: message || step.errorMessage || 'An error occurred during execution'
      });
    }
  }

  /**
   * Get progress observable for a command
   */
  getProgress$(commandId: string): Observable<EnhancedProgress | undefined> {
    return this.progressSubject.pipe(
      map(progressMap => progressMap.get(commandId)),
      filter(progress => progress !== undefined),
      distinctUntilChanged((a, b) => 
        JSON.stringify(a) === JSON.stringify(b)
      )
    );
  }

  /**
   * Get all progress updates
   */
  getAllProgress$(): Observable<Map<string, EnhancedProgress>> {
    return this.progressSubject.asObservable();
  }

  /**
   * Get notifications observable
   */
  getNotifications$(): Observable<ProgressNotification> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Get alerts observable
   */
  getAlerts$(): Observable<Alert> {
    return this.alertSubject.asObservable();
  }

  /**
   * Get performance metrics observable
   */
  getMetrics$(): Observable<CommandPerformanceMetrics> {
    return this.metricsSubject.asObservable();
  }

  /**
   * Get analytics observable
   */
  getAnalytics$(): Observable<PerformanceAnalytics | null> {
    return this.analyticsSubject.asObservable();
  }

  /**
   * Add an alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      this.alertSubject.next(alert);
    }
  }

  /**
   * Get progress history for a command
   */
  getProgressHistory(commandId: string): ProgressHistoryEntry[] {
    return this.historyMap.get(commandId) || [];
  }

  /**
   * Replay progress history
   */
  async replayHistory(
    commandId: string, 
    speed: number = 1,
    onUpdate?: (progress: EnhancedProgress) => void
  ): Promise<void> {
    const history = this.getProgressHistory(commandId);
    if (history.length === 0) return;

    for (const entry of history) {
      if (onUpdate) {
        onUpdate(entry.snapshot);
      }
      
      // Wait based on replay speed
      const delay = entry.events.length > 0 
        ? (entry.events[0].timestamp.getTime() - entry.timestamp.getTime()) / speed
        : 100 / speed;
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProgressTrackingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart intervals if needed
    if (config.updateInterval && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = setInterval(() => {
        this.calculateAnalytics();
      }, this.config.updateInterval);
    }
    
    if (config.alertCheckInterval && this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = setInterval(() => {
        this.checkAlerts();
      }, this.config.alertCheckInterval);
    }
  }

  /**
   * Clean up and destroy the service
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.updateInterval) clearInterval(this.updateInterval);
    if (this.alertInterval) clearInterval(this.alertInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    this.progressMap.clear();
    this.historyMap.clear();
    this.alertRules.clear();
    this.activeAlerts.clear();
    this.performanceBuffer = [];
  }

  private setupWebSocketHandlers(): void {
    // Progress update events
    this.wsClient.on(ProgressTrackingEvent.PROGRESS_UPDATE, (data: any) => {
      const { commandId, stepId, progress, message } = data;
      this.updateStepProgress(commandId, stepId, progress, undefined, message);
    });

    // Step events
    this.wsClient.on(ProgressTrackingEvent.STEP_STARTED, (data: any) => {
      const { commandId, stepId } = data;
      this.updateStepProgress(commandId, stepId, 0, 'active');
    });

    this.wsClient.on(ProgressTrackingEvent.STEP_COMPLETED, (data: any) => {
      const { commandId, stepId } = data;
      this.updateStepProgress(commandId, stepId, 1, 'completed');
    });

    // Performance metrics
    this.wsClient.on(ProgressTrackingEvent.PERFORMANCE_METRICS, (metrics: CommandPerformanceMetrics) => {
      this.performanceBuffer.push(metrics);
      this.metricsSubject.next(metrics);
    });

    // Command events
    this.wsClient.on(CommandEventType.COMMAND_COMPLETED, (event: any) => {
      this.finalizeProgress(event.command.id, 'success');
    });

    this.wsClient.on(CommandEventType.COMMAND_FAILED, (event: any) => {
      this.finalizeProgress(event.command.id, 'failure');
    });
  }

  private generateDefaultSteps(command: Command): ProgressStep[] {
    const baseSteps: ProgressStep[] = [
      {
        id: 'queue',
        name: 'Queue',
        description: 'Waiting in command queue',
        order: 1,
        status: 'pending',
        progress: 0
      },
      {
        id: 'validation',
        name: 'Validation',
        description: 'Validating command parameters',
        order: 2,
        status: 'pending',
        progress: 0
      },
      {
        id: 'execution',
        name: 'Execution',
        description: 'Executing command',
        order: 3,
        status: 'pending',
        progress: 0
      },
      {
        id: 'result',
        name: 'Result Processing',
        description: 'Processing command results',
        order: 4,
        status: 'pending',
        progress: 0
      }
    ];

    // Add command-specific steps
    switch (command.commandType) {
      case 'firmware_update':
        return [
          ...baseSteps.slice(0, 2),
          {
            id: 'download',
            name: 'Download Firmware',
            order: 3,
            status: 'pending',
            progress: 0
          },
          {
            id: 'verify',
            name: 'Verify Firmware',
            order: 4,
            status: 'pending',
            progress: 0
          },
          {
            id: 'flash',
            name: 'Flash Firmware',
            order: 5,
            status: 'pending',
            progress: 0
          },
          {
            id: 'reboot',
            name: 'Reboot Device',
            order: 6,
            status: 'pending',
            progress: 0
          },
          baseSteps[3]
        ];
      
      case 'diagnostic':
        return [
          ...baseSteps.slice(0, 2),
          {
            id: 'system_check',
            name: 'System Check',
            order: 3,
            status: 'pending',
            progress: 0
          },
          {
            id: 'sensor_check',
            name: 'Sensor Check',
            order: 4,
            status: 'pending',
            progress: 0
          },
          {
            id: 'comm_check',
            name: 'Communication Check',
            order: 5,
            status: 'pending',
            progress: 0
          },
          baseSteps[3]
        ];
      
      default:
        return baseSteps;
    }
  }

  private findStep(steps: ProgressStep[], stepId: string): ProgressStep | null {
    for (const step of steps) {
      if (step.id === stepId) return step;
      if (step.substeps) {
        const found = this.findStep(step.substeps, stepId);
        if (found) return found;
      }
    }
    return null;
  }

  private calculateOverallProgress(steps: ProgressStep[]): number {
    let totalWeight = 0;
    let weightedProgress = 0;

    const calculateStepProgress = (step: ProgressStep, weight: number = 1): void => {
      if (step.substeps && step.substeps.length > 0) {
        // Recursively calculate substep progress
        const substepWeight = weight / step.substeps.length;
        step.substeps.forEach(substep => calculateStepProgress(substep, substepWeight));
      } else {
        totalWeight += weight;
        weightedProgress += step.progress * weight;
      }
    };

    steps.forEach(step => calculateStepProgress(step));

    return totalWeight > 0 ? weightedProgress / totalWeight : 0;
  }

  private checkForStalls(progress: EnhancedProgress): void {
    const now = Date.now();
    const lastUpdate = progress.lastUpdatedAt.getTime();
    const timeSinceUpdate = now - lastUpdate;

    // Consider stalled if no update for 30 seconds on active steps
    const activeStep = progress.steps.find(s => s.status === 'active');
    if (activeStep && timeSinceUpdate > 30000 && !progress.isStalled) {
      progress.isStalled = true;
      progress.stalledDuration = timeSinceUpdate;
      
      this.createNotification({
        commandId: progress.commandId,
        type: 'warning',
        severity: 'medium',
        title: 'Command Stalled',
        message: `Command ${progress.commandId} has stalled at step: ${activeStep.name}`
      });

      this.wsClient.emit(ProgressTrackingEvent.COMMAND_STALLED, {
        commandId: progress.commandId,
        stepId: activeStep.id,
        duration: timeSinceUpdate
      });
    } else if (progress.isStalled && timeSinceUpdate < 5000) {
      // Resumed
      progress.isStalled = false;
      progress.stalledDuration = undefined;
      
      this.wsClient.emit(ProgressTrackingEvent.COMMAND_RESUMED, {
        commandId: progress.commandId
      });
    }
  }

  private updateProgressFromAcknowledgment(commandId: string, ack: any): void {
    const progress = this.progressMap.get(commandId);
    if (!progress) return;

    // Map acknowledgment status to step updates
    switch (ack.status) {
      case 'acknowledged':
        this.updateStepProgress(commandId, 'queue', 1, 'completed');
        this.updateStepProgress(commandId, 'validation', 0.5, 'active');
        break;
      
      case 'in_progress':
        this.updateStepProgress(commandId, 'validation', 1, 'completed');
        this.updateStepProgress(commandId, 'execution', ack.progress || 0, 'active');
        break;
      
      case 'completed':
        this.updateStepProgress(commandId, 'execution', 1, 'completed');
        this.updateStepProgress(commandId, 'result', 1, 'completed');
        break;
      
      case 'failed':
        const activeStep = progress.steps.find(s => s.status === 'active');
        if (activeStep) {
          this.updateStepProgress(commandId, activeStep.id, activeStep.progress, 'error', ack.errorMessage);
        }
        break;
    }
  }

  private emitProgressUpdate(progress: EnhancedProgress, event?: ProgressUpdateEvent): void {
    const updatedMap = new Map(this.progressSubject.value);
    updatedMap.set(progress.commandId, progress);
    this.progressSubject.next(updatedMap);

    // Add to history if enabled
    if (this.config.enableHistory) {
      this.addToHistory(progress, event);
    }
  }

  private addToHistory(progress: EnhancedProgress, event?: ProgressUpdateEvent): void {
    const commandHistory = this.historyMap.get(progress.commandId) || [];
    
    const entry: ProgressHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commandId: progress.commandId,
      timestamp: new Date(),
      snapshot: JSON.parse(JSON.stringify(progress)), // Deep clone
      events: event ? [event] : [],
      metrics: this.performanceBuffer.find(m => m.commandId === progress.commandId) || {
        commandId: progress.commandId,
        commandType: 'custom' as any,
        priority: 1,
        queueTime: 0,
        executionTime: 0,
        totalTime: 0,
        errorCount: 0,
        retryCount: progress.retryCount,
        timestamp: new Date()
      },
      outcome: progress.overallProgress >= 1 ? 'success' : 
               progress.errorRate > 0 ? 'failure' : 
               'cancelled'
    };

    commandHistory.push(entry);
    
    // Limit history size
    if (commandHistory.length > this.config.maxHistoryEntries) {
      commandHistory.shift();
    }
    
    this.historyMap.set(progress.commandId, commandHistory);
  }

  private createNotification(params: {
    commandId: string;
    type: ProgressNotification['type'];
    severity: ProgressNotification['severity'];
    title: string;
    message: string;
    actions?: ProgressNotification['actions'];
  }): void {
    const notification: ProgressNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commandId: params.commandId,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      timestamp: new Date(),
      read: false,
      actionable: !!params.actions && params.actions.length > 0,
      actions: params.actions,
      autoHide: params.type === 'info' || params.type === 'success',
      autoHideDelay: 5000
    };

    this.notificationSubject.next(notification);
    
    // Emit to WebSocket
    this.wsClient.emit(ProgressTrackingEvent.NOTIFICATION_CREATED, notification);
  }

  private checkAlerts(): void {
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      // Check if cooldown period has passed
      if (rule.lastTriggered && rule.cooldownPeriod) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldownPeriod) return;
      }

      // Evaluate conditions
      const conditionsMet = rule.conditions.every(condition => 
        this.evaluateAlertCondition(condition)
      );

      if (conditionsMet) {
        this.triggerAlert(rule);
      }
    });
  }

  private evaluateAlertCondition(condition: any): boolean {
    // Implement condition evaluation logic based on metrics
    const analytics = this.analyticsSubject.value;
    if (!analytics) return false;

    switch (condition.metric) {
      case 'execution_time':
        return this.compareValue(analytics.averageExecutionTime, condition.operator, condition.threshold);
      
      case 'error_rate':
        return this.compareValue(analytics.errorRate, condition.operator, condition.threshold);
      
      case 'throughput':
        return this.compareValue(analytics.throughput.current, condition.operator, condition.threshold);
      
      default:
        return false;
    }
  }

  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: 'high', // Determine based on conditions
      triggeredAt: new Date(),
      affectedCommands: Array.from(this.progressMap.keys()),
      message: `Alert: ${rule.name}`,
      details: {
        conditions: rule.conditions,
        currentMetrics: this.analyticsSubject.value
      },
      acknowledged: false
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertSubject.next(alert);

    // Update rule
    rule.lastTriggered = new Date();
    rule.triggerCount++;

    // Execute actions
    rule.actions.forEach(action => this.executeAlertAction(action, alert));

    // Emit to WebSocket
    this.wsClient.emit(ProgressTrackingEvent.ALERT_TRIGGERED, alert);
  }

  private executeAlertAction(action: any, alert: Alert): void {
    switch (action.type) {
      case 'notification':
        this.createNotification({
          commandId: 'system',
          type: 'warning',
          severity: alert.severity,
          title: alert.ruleName,
          message: alert.message
        });
        break;
      
      case 'log':
        console.warn('Alert triggered:', alert);
        break;
      
      // Implement other action types as needed
    }
  }

  private calculateAnalytics(): void {
    const now = new Date();
    const timeRange = {
      start: new Date(now.getTime() - 3600000), // Last hour
      end: now
    };

    // Filter metrics within time range
    const recentMetrics = this.performanceBuffer.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );

    if (recentMetrics.length === 0) return;

    // Calculate analytics
    const analytics: PerformanceAnalytics = {
      timeRange,
      totalCommands: recentMetrics.length,
      averageQueueTime: this.average(recentMetrics.map(m => m.queueTime)),
      averageExecutionTime: this.average(recentMetrics.map(m => m.executionTime)),
      p50ExecutionTime: this.percentile(recentMetrics.map(m => m.executionTime), 50),
      p95ExecutionTime: this.percentile(recentMetrics.map(m => m.executionTime), 95),
      p99ExecutionTime: this.percentile(recentMetrics.map(m => m.executionTime), 99),
      successRate: recentMetrics.filter(m => m.errorCount === 0).length / recentMetrics.length,
      errorRate: recentMetrics.filter(m => m.errorCount > 0).length / recentMetrics.length,
      throughput: {
        current: this.progressMap.size,
        average: recentMetrics.length / (timeRange.end.getTime() - timeRange.start.getTime()) * 1000,
        peak: Math.max(...recentMetrics.map(m => m.throughput || 0))
      },
      commandTypeBreakdown: {} as any,
      priorityBreakdown: {} as any,
      errorCategories: {},
      resourceUsage: {
        avgCpuUsage: this.average(recentMetrics.map(m => m.cpuUsage || 0)),
        peakCpuUsage: Math.max(...recentMetrics.map(m => m.cpuUsage || 0)),
        avgMemoryUsage: this.average(recentMetrics.map(m => m.memoryUsage || 0)),
        peakMemoryUsage: Math.max(...recentMetrics.map(m => m.memoryUsage || 0))
      }
    };

    this.analyticsSubject.next(analytics);
  }

  private finalizeProgress(commandId: string, outcome: 'success' | 'failure'): void {
    const progress = this.progressMap.get(commandId);
    if (!progress) return;

    progress.actualCompletionTime = new Date();
    
    if (outcome === 'success') {
      // Mark all pending steps as completed
      progress.steps.forEach(step => {
        if (step.status === 'pending' || step.status === 'active') {
          step.status = 'completed';
          step.progress = 1;
        }
      });
      progress.overallProgress = 1;
    }

    this.emitProgressUpdate(progress);

    // Create completion notification
    if (this.config.notificationThreshold[outcome === 'success' ? 'success' : 'error']) {
      this.createNotification({
        commandId,
        type: outcome === 'success' ? 'success' : 'error',
        severity: outcome === 'success' ? 'low' : 'high',
        title: `Command ${outcome === 'success' ? 'Completed' : 'Failed'}`,
        message: `Command ${commandId} ${outcome === 'success' ? 'completed successfully' : 'failed'}`
      });
    }

    // Clean up after a delay
    setTimeout(() => {
      this.progressMap.delete(commandId);
      this.emitProgressUpdate(progress);
    }, 60000); // Keep for 1 minute after completion
  }

  private cleanupOldData(): void {
    const now = Date.now();

    // Clean up old history
    this.historyMap.forEach((history, commandId) => {
      const filtered = history.filter(entry => 
        now - entry.timestamp.getTime() < this.config.historyRetentionPeriod
      );
      if (filtered.length !== history.length) {
        this.historyMap.set(commandId, filtered);
      }
      if (filtered.length === 0) {
        this.historyMap.delete(commandId);
      }
    });

    // Clean up old metrics
    this.performanceBuffer = this.performanceBuffer.filter(metric =>
      now - metric.timestamp.getTime() < this.config.metricsRetentionPeriod
    );

    // Clean up resolved alerts
    this.activeAlerts.forEach((alert, id) => {
      if (alert.resolvedAt && now - alert.resolvedAt.getTime() > 3600000) {
        this.activeAlerts.delete(id);
      }
    });
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private percentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

export default ProgressTrackingService;