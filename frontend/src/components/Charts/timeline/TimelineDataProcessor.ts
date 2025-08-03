/**
 * TimelineDataProcessor - Advanced Timeline Analysis & Optimization
 * 
 * Comprehensive utility for processing timeline data in the RoverMissionControl project.
 * Implements Critical Path Method (CPM), resource optimization, and advanced scheduling algorithms.
 * 
 * Features:
 * - Critical Path Method (CPM) with slack time calculation
 * - Resource leveling and allocation optimization
 * - Schedule compression and expansion algorithms
 * - Dependency validation and cycle detection
 * - Performance metrics and bottleneck identification
 * - Task aggregation and conflict detection
 * - Data validation and sanitization
 * - Multi-format export capabilities
 * 
 * @author RoverMissionControl Team
 * @version 1.0.0
 */

import { GanttTask, MissionEvent, Resource, TimelineStatistics } from './types';
import { ChartDataPoint, TimeSeriesDataPoint } from '../types';

// Enums for better type safety
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ConflictType {
  RESOURCE_OVERALLOCATION = 'resource_overallocation',
  SCHEDULE_OVERLAP = 'schedule_overlap',
  DEPENDENCY_VIOLATION = 'dependency_violation',
  MILESTONE_DELAY = 'milestone_delay'
}

// Advanced interfaces for timeline processing
export interface CriticalPathNode {
  taskId: string;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  totalSlack: number;
  freeSlack: number;
  isCritical: boolean;
  successors: string[];
  predecessors: string[];
}

export interface ResourceAllocation {
  resourceId: string;
  taskId: string;
  allocation: number; // Percentage (0-100)
  startDate: Date;
  endDate: Date;
  conflictLevel: number; // 0-1 scale
}

export interface TaskConflict {
  type: ConflictType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedTaskIds: string[];
  description: string;
  suggestedResolution: string;
  impact: {
    scheduleDelay: number; // Days
    resourceWaste: number; // Percentage
    costImpact: number; // Arbitrary units
  };
}

export interface TimeWindow {
  start: Date;
  end: Date;
  taskCount: number;
  resourceUtilization: Record<string, number>;
  criticalTasks: string[];
  events: MissionEvent[];
}

export interface Bottleneck {
  taskId: string;
  resourceId?: string;
  type: 'resource' | 'dependency' | 'duration' | 'skill';
  severity: number; // 0-1 scale
  impact: {
    delayDays: number;
    affectedTasks: string[];
    costIncrease: number;
  };
  mitigation: {
    strategy: string;
    effort: 'low' | 'medium' | 'high';
    effectiveness: number; // 0-1 scale
  };
}

export interface ProgressMetrics {
  overallProgress: number; // 0-100
  schedulePerformanceIndex: number; // SPI
  costPerformanceIndex: number; // CPI
  earnedValue: number;
  plannedValue: number;
  actualCost: number;
  estimateAtCompletion: number;
  varianceAtCompletion: number;
  scheduleVariance: number;
  costVariance: number;
}

export interface BaselineComparison {
  taskId: string;
  baseline: {
    startDate: Date;
    endDate: Date;
    duration: number;
    resources: string[];
  };
  current: {
    startDate: Date;
    endDate: Date;
    duration: number;
    resources: string[];
  };
  variance: {
    startVariance: number; // Days
    endVariance: number; // Days
    durationVariance: number; // Days
    progressVariance: number; // Percentage
  };
}

export interface ExportFormat {
  format: 'json' | 'csv' | 'xlsx' | 'xml' | 'mpp' | 'gantt' | 'ical';
  options: {
    includeMetadata?: boolean;
    includeResources?: boolean;
    includeDependencies?: boolean;
    includeProgress?: boolean;
    dateFormat?: string;
    encoding?: string;
    compression?: boolean;
  };
}

export interface ProcessingOptions {
  calculateCriticalPath: boolean;
  validateDependencies: boolean;
  optimizeResources: boolean;
  detectConflicts: boolean;
  performBottleneckAnalysis: boolean;
  aggregateByTimeWindow: boolean;
  timeWindowSize: number; // Hours
  enableProgressTracking: boolean;
  enableBaselineComparison: boolean;
  performanceThresholds: {
    maxProcessingTime: number; // Milliseconds
    maxTaskCount: number;
    warnOnComplexity: boolean;
  };
}

/**
 * Main TimelineDataProcessor class
 * Handles all timeline analysis, optimization, and data processing operations
 */
export class TimelineDataProcessor {
  private tasks: GanttTask[] = [];
  private resources: Resource[] = [];
  private events: MissionEvent[] = [];
  private criticalPath: CriticalPathNode[] = [];
  private conflicts: TaskConflict[] = [];
  private bottlenecks: Bottleneck[] = [];
  private options: ProcessingOptions;

  constructor(options: Partial<ProcessingOptions> = {}) {
    this.options = {
      calculateCriticalPath: true,
      validateDependencies: true,
      optimizeResources: true,
      detectConflicts: true,
      performBottleneckAnalysis: true,
      aggregateByTimeWindow: true,
      timeWindowSize: 24, // 24 hours
      enableProgressTracking: true,
      enableBaselineComparison: false,
      performanceThresholds: {
        maxProcessingTime: 5000, // 5 seconds
        maxTaskCount: 10000,
        warnOnComplexity: true
      },
      ...options
    };
  }

  /**
   * Main processing method - orchestrates all analysis operations
   */
  public async processTimeline(
    tasks: GanttTask[],
    resources: Resource[] = [],
    events: MissionEvent[] = []
  ): Promise<{
    processedTasks: GanttTask[];
    criticalPath: CriticalPathNode[];
    conflicts: TaskConflict[];
    bottlenecks: Bottleneck[];
    statistics: TimelineStatistics;
    timeWindows: TimeWindow[];
    resourceAllocations: ResourceAllocation[];
    progressMetrics: ProgressMetrics;
  }> {
    const startTime = performance.now();

    try {
      // Input validation and sanitization
      this.validateAndSanitizeInput(tasks, resources, events);
      
      this.tasks = [...tasks];
      this.resources = [...resources];
      this.events = [...events];

      // Performance check
      if (this.options.performanceThresholds.warnOnComplexity && 
          tasks.length > this.options.performanceThresholds.maxTaskCount) {
        console.warn(`Large dataset detected: ${tasks.length} tasks. Consider enabling virtualization.`);
      }

      const results = {
        processedTasks: this.tasks,
        criticalPath: [] as CriticalPathNode[],
        conflicts: [] as TaskConflict[],
        bottlenecks: [] as Bottleneck[],
        statistics: this.calculateBasicStatistics(),
        timeWindows: [] as TimeWindow[],
        resourceAllocations: [] as ResourceAllocation[],
        progressMetrics: this.calculateProgressMetrics()
      };

      // Execute processing pipeline
      if (this.options.validateDependencies) {
        this.validateDependencies();
      }

      if (this.options.calculateCriticalPath) {
        results.criticalPath = this.calculateCriticalPath();
        this.criticalPath = results.criticalPath;
      }

      if (this.options.optimizeResources && resources.length > 0) {
        results.resourceAllocations = this.optimizeResourceAllocation();
      }

      if (this.options.detectConflicts) {
        results.conflicts = this.detectConflicts();
        this.conflicts = results.conflicts;
      }

      if (this.options.performBottleneckAnalysis) {
        results.bottlenecks = this.identifyBottlenecks();
        this.bottlenecks = results.bottlenecks;
      }

      if (this.options.aggregateByTimeWindow) {
        results.timeWindows = this.aggregateByTimeWindow(this.options.timeWindowSize);
      }

      // Update statistics with processed data
      results.statistics = this.calculateAdvancedStatistics();

      const processingTime = performance.now() - startTime;
      if (processingTime > this.options.performanceThresholds.maxProcessingTime) {
        console.warn(`Processing took ${processingTime.toFixed(2)}ms, exceeding threshold of ${this.options.performanceThresholds.maxProcessingTime}ms`);
      }

      return results;

    } catch (error) {
      console.error('Timeline processing failed:', error);
      throw new Error(`Timeline processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Critical Path Method (CPM) Implementation
   * Calculates the longest path through the project network
   */
  private calculateCriticalPath(): CriticalPathNode[] {
    const nodes = new Map<string, CriticalPathNode>();
    
    // Initialize nodes
    this.tasks.forEach(task => {
      nodes.set(task.id, {
        taskId: task.id,
        earliestStart: new Date(task.startDate),
        earliestFinish: new Date(task.endDate),
        latestStart: new Date(task.startDate),
        latestFinish: new Date(task.endDate),
        totalSlack: 0,
        freeSlack: 0,
        isCritical: false,
        successors: [],
        predecessors: task.dependencies || []
      });
    });

    // Build network relationships
    this.buildNetworkRelationships(nodes);

    // Forward pass - calculate earliest times
    this.forwardPass(nodes);

    // Backward pass - calculate latest times
    this.backwardPass(nodes);

    // Calculate slack and identify critical path
    this.calculateSlackAndCriticalPath(nodes);

    return Array.from(nodes.values());
  }

  private buildNetworkRelationships(nodes: Map<string, CriticalPathNode>): void {
    nodes.forEach(node => {
      node.predecessors.forEach(predId => {
        const predNode = nodes.get(predId);
        if (predNode) {
          predNode.successors.push(node.taskId);
        }
      });
    });
  }

  private forwardPass(nodes: Map<string, CriticalPathNode>): void {
    const processed = new Set<string>();
    const queue = Array.from(nodes.values()).filter(node => node.predecessors.length === 0);

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      if (processed.has(currentNode.taskId)) continue;

      // Calculate earliest start based on predecessors
      let maxPredFinish = new Date(0);
      currentNode.predecessors.forEach(predId => {
        const predNode = nodes.get(predId);
        if (predNode && predNode.earliestFinish > maxPredFinish) {
          maxPredFinish = new Date(predNode.earliestFinish);
        }
      });

      if (currentNode.predecessors.length > 0) {
        currentNode.earliestStart = maxPredFinish;
      }

      // Calculate earliest finish
      const task = this.tasks.find(t => t.id === currentNode.taskId);
      if (task) {
        const duration = task.endDate.getTime() - task.startDate.getTime();
        currentNode.earliestFinish = new Date(currentNode.earliestStart.getTime() + duration);
      }

      processed.add(currentNode.taskId);

      // Add successors to queue if all their predecessors are processed
      currentNode.successors.forEach(succId => {
        const succNode = nodes.get(succId);
        if (succNode && succNode.predecessors.every(predId => processed.has(predId))) {
          queue.push(succNode);
        }
      });
    }
  }

  private backwardPass(nodes: Map<string, CriticalPathNode>): void {
    const processed = new Set<string>();
    const endNodes = Array.from(nodes.values()).filter(node => node.successors.length === 0);
    
    // Initialize end nodes
    endNodes.forEach(node => {
      node.latestFinish = new Date(node.earliestFinish);
      node.latestStart = new Date(node.latestFinish.getTime() - 
        (node.earliestFinish.getTime() - this.tasks.find(t => t.id === node.taskId)!.startDate.getTime()));
    });

    const queue = [...endNodes];

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      if (processed.has(currentNode.taskId)) continue;

      // Calculate latest finish based on successors
      let minSuccStart = new Date(currentNode.latestFinish);
      currentNode.successors.forEach(succId => {
        const succNode = nodes.get(succId);
        if (succNode && succNode.latestStart < minSuccStart) {
          minSuccStart = new Date(succNode.latestStart);
        }
      });

      if (currentNode.successors.length > 0) {
        currentNode.latestFinish = minSuccStart;
      }

      // Calculate latest start
      const task = this.tasks.find(t => t.id === currentNode.taskId);
      if (task) {
        const duration = task.endDate.getTime() - task.startDate.getTime();
        currentNode.latestStart = new Date(currentNode.latestFinish.getTime() - duration);
      }

      processed.add(currentNode.taskId);

      // Add predecessors to queue
      currentNode.predecessors.forEach(predId => {
        const predNode = nodes.get(predId);
        if (predNode && !processed.has(predId)) {
          queue.push(predNode);
        }
      });
    }
  }

  private calculateSlackAndCriticalPath(nodes: Map<string, CriticalPathNode>): void {
    nodes.forEach(node => {
      // Total slack = Latest Start - Earliest Start
      node.totalSlack = Math.max(0, Math.floor(
        (node.latestStart.getTime() - node.earliestStart.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Free slack calculation
      let minSuccEarlyStart = Infinity;
      node.successors.forEach(succId => {
        const succNode = nodes.get(succId);
        if (succNode) {
          minSuccEarlyStart = Math.min(minSuccEarlyStart, succNode.earliestStart.getTime());
        }
      });

      if (minSuccEarlyStart !== Infinity) {
        node.freeSlack = Math.max(0, Math.floor(
          (minSuccEarlyStart - node.earliestFinish.getTime()) / (1000 * 60 * 60 * 24)
        ));
      } else {
        node.freeSlack = node.totalSlack;
      }

      // Critical path identification (slack = 0 or very small)
      node.isCritical = node.totalSlack <= 0.1; // Allow for small floating point errors
    });
  }

  /**
   * Resource Leveling and Optimization
   * Optimizes resource allocation to minimize conflicts and maximize efficiency
   */
  private optimizeResourceAllocation(): ResourceAllocation[] {
    const allocations: ResourceAllocation[] = [];
    const resourceSchedules = new Map<string, Array<{ start: Date; end: Date; taskId: string; allocation: number }>>();

    // Initialize resource schedules
    this.resources.forEach(resource => {
      resourceSchedules.set(resource.id, []);
    });

    // Sort tasks by priority and earliest start date
    const sortedTasks = [...this.tasks].sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority || 'medium'];
      const bPriority = priorityWeight[b.priority || 'medium'];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return a.startDate.getTime() - b.startDate.getTime();
    });

    // Allocate resources using resource leveling algorithm
    sortedTasks.forEach(task => {
      if (task.resourceId) {
        const resource = this.resources.find(r => r.id === task.resourceId);
        if (resource) {
          const allocation = this.calculateOptimalAllocation(task, resource, resourceSchedules);
          allocations.push(allocation);
          
          // Update resource schedule
          const schedule = resourceSchedules.get(resource.id)!;
          schedule.push({
            start: allocation.startDate,
            end: allocation.endDate,
            taskId: task.id,
            allocation: allocation.allocation
          });
        }
      }
    });

    return allocations;
  }

  private calculateOptimalAllocation(
    task: GanttTask,
    resource: Resource,
    resourceSchedules: Map<string, Array<{ start: Date; end: Date; taskId: string; allocation: number }>>
  ): ResourceAllocation {
    const schedule = resourceSchedules.get(resource.id)!;
    let conflictLevel = 0;
    let optimalStart = new Date(task.startDate);
    let optimalEnd = new Date(task.endDate);

    // Check for resource conflicts and calculate conflict level
    schedule.forEach(booking => {
      if (this.dateRangesOverlap(
        { start: task.startDate, end: task.endDate },
        { start: booking.start, end: booking.end }
      )) {
        conflictLevel += booking.allocation / 100;
      }
    });

    // If conflict level is too high, try to reschedule
    if (conflictLevel > 0.8) {
      const rescheduled = this.findOptimalScheduleSlot(task, resource, schedule);
      if (rescheduled) {
        optimalStart = rescheduled.start;
        optimalEnd = rescheduled.end;
        conflictLevel = rescheduled.conflictLevel;
      }
    }

    return {
      resourceId: resource.id,
      taskId: task.id,
      allocation: Math.min(100, Math.max(0, 100 - conflictLevel * 50)), // Reduce allocation based on conflicts
      startDate: optimalStart,
      endDate: optimalEnd,
      conflictLevel: Math.min(1, conflictLevel)
    };
  }

  private findOptimalScheduleSlot(
    task: GanttTask,
    resource: Resource,
    schedule: Array<{ start: Date; end: Date; taskId: string; allocation: number }>
  ): { start: Date; end: Date; conflictLevel: number } | null {
    const duration = task.endDate.getTime() - task.startDate.getTime();
    const searchStart = new Date(task.startDate.getTime() - duration); // Look backward
    const searchEnd = new Date(task.endDate.getTime() + duration * 2); // Look forward
    
    const timeSlots = this.generateTimeSlots(searchStart, searchEnd, duration);
    
    for (const slot of timeSlots) {
      let conflictLevel = 0;
      schedule.forEach(booking => {
        if (this.dateRangesOverlap(slot, { start: booking.start, end: booking.end })) {
          conflictLevel += booking.allocation / 100;
        }
      });
      
      if (conflictLevel < 0.5) { // Acceptable conflict level
        return { ...slot, conflictLevel };
      }
    }
    
    return null;
  }

  private generateTimeSlots(start: Date, end: Date, duration: number): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    const stepSize = duration / 4; // Quarter of task duration steps
    
    for (let current = start.getTime(); current + duration <= end.getTime(); current += stepSize) {
      slots.push({
        start: new Date(current),
        end: new Date(current + duration)
      });
    }
    
    return slots;
  }

  /**
   * Conflict Detection
   * Identifies various types of conflicts in the timeline
   */
  private detectConflicts(): TaskConflict[] {
    const conflicts: TaskConflict[] = [];

    // Resource overallocation conflicts
    conflicts.push(...this.detectResourceConflicts());

    // Schedule overlap conflicts
    conflicts.push(...this.detectScheduleConflicts());

    // Dependency violation conflicts
    conflicts.push(...this.detectDependencyConflicts());

    // Milestone delay conflicts
    conflicts.push(...this.detectMilestoneConflicts());

    return conflicts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  private detectResourceConflicts(): TaskConflict[] {
    const conflicts: TaskConflict[] = [];
    const resourceUsage = new Map<string, Array<{ task: GanttTask; usage: number }>>();

    // Build resource usage map
    this.tasks.forEach(task => {
      if (task.resourceId) {
        if (!resourceUsage.has(task.resourceId)) {
          resourceUsage.set(task.resourceId, []);
        }
        resourceUsage.get(task.resourceId)!.push({ task, usage: 100 }); // Assume 100% usage
      }
    });

    // Check for overallocation
    resourceUsage.forEach((usage, resourceId) => {
      const overlappingTasks = this.findOverlappingTasks(usage.map(u => u.task));
      
      if (overlappingTasks.length > 1) {
        conflicts.push({
          type: ConflictType.RESOURCE_OVERALLOCATION,
          severity: this.calculateConflictSeverity(overlappingTasks),
          affectedTaskIds: overlappingTasks.map(t => t.id),
          description: `Resource ${resourceId} is overallocated across ${overlappingTasks.length} overlapping tasks`,
          suggestedResolution: 'Reschedule tasks or allocate additional resources',
          impact: {
            scheduleDelay: this.calculateScheduleDelay(overlappingTasks),
            resourceWaste: overlappingTasks.length * 25, // Arbitrary calculation
            costImpact: overlappingTasks.length * 1000 // Arbitrary cost units
          }
        });
      }
    });

    return conflicts;
  }

  private detectScheduleConflicts(): TaskConflict[] {
    const conflicts: TaskConflict[] = [];
    
    for (let i = 0; i < this.tasks.length; i++) {
      for (let j = i + 1; j < this.tasks.length; j++) {
        const task1 = this.tasks[i];
        const task2 = this.tasks[j];
        
        if (task1.resourceId === task2.resourceId && 
            this.dateRangesOverlap(
              { start: task1.startDate, end: task1.endDate },
              { start: task2.startDate, end: task2.endDate }
            )) {
          conflicts.push({
            type: ConflictType.SCHEDULE_OVERLAP,
            severity: 'medium',
            affectedTaskIds: [task1.id, task2.id],
            description: `Tasks ${task1.name} and ${task2.name} have overlapping schedules`,
            suggestedResolution: 'Adjust task schedules to eliminate overlap',
            impact: {
              scheduleDelay: this.calculateOverlapDays(task1, task2),
              resourceWaste: 50,
              costImpact: 500
            }
          });
        }
      }
    }
    
    return conflicts;
  }

  private detectDependencyConflicts(): TaskConflict[] {
    const conflicts: TaskConflict[] = [];
    
    this.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          const dependency = this.tasks.find(t => t.id === depId);
          if (dependency && dependency.endDate > task.startDate) {
            conflicts.push({
              type: ConflictType.DEPENDENCY_VIOLATION,
              severity: 'high',
              affectedTaskIds: [task.id, depId],
              description: `Task ${task.name} starts before dependency ${dependency.name} completes`,
              suggestedResolution: 'Adjust task start date or dependency completion date',
              impact: {
                scheduleDelay: Math.ceil((dependency.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)),
                resourceWaste: 25,
                costImpact: 750
              }
            });
          }
        });
      }
    });
    
    return conflicts;
  }

  private detectMilestoneConflicts(): TaskConflict[] {
    const conflicts: TaskConflict[] = [];
    const milestoneEvents = this.events.filter(e => e.type === 'milestone');
    
    milestoneEvents.forEach(milestone => {
      const relatedTasks = this.tasks.filter(task => 
        milestone.relatedTaskIds?.includes(task.id) && 
        task.endDate > milestone.timestamp
      );
      
      if (relatedTasks.length > 0) {
        conflicts.push({
          type: ConflictType.MILESTONE_DELAY,
          severity: 'critical',
          affectedTaskIds: relatedTasks.map(t => t.id),
          description: `Milestone "${milestone.title}" may be delayed due to ${relatedTasks.length} overrunning tasks`,
          suggestedResolution: 'Accelerate critical tasks or adjust milestone date',
          impact: {
            scheduleDelay: Math.max(...relatedTasks.map(t => 
              Math.ceil((t.endDate.getTime() - milestone.timestamp.getTime()) / (1000 * 60 * 60 * 24))
            )),
            resourceWaste: relatedTasks.length * 15,
            costImpact: relatedTasks.length * 2000
          }
        });
      }
    });
    
    return conflicts;
  }

  /**
   * Bottleneck Identification
   * Identifies performance bottlenecks in the timeline
   */
  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Resource bottlenecks
    bottlenecks.push(...this.identifyResourceBottlenecks());

    // Dependency bottlenecks
    bottlenecks.push(...this.identifyDependencyBottlenecks());

    // Duration bottlenecks
    bottlenecks.push(...this.identifyDurationBottlenecks());

    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  private identifyResourceBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const resourceDemand = new Map<string, number>();

    // Calculate resource demand
    this.tasks.forEach(task => {
      if (task.resourceId) {
        resourceDemand.set(task.resourceId, (resourceDemand.get(task.resourceId) || 0) + 1);
      }
    });

    // Identify overutilized resources
    resourceDemand.forEach((demand, resourceId) => {
      const resource = this.resources.find(r => r.id === resourceId);
      if (resource && demand > (resource.capacity || 1) * 1.2) { // 20% over capacity
        const affectedTasks = this.tasks.filter(t => t.resourceId === resourceId).map(t => t.id);
        
        bottlenecks.push({
          taskId: affectedTasks[0], // Primary affected task
          resourceId,
          type: 'resource',
          severity: Math.min(1, demand / ((resource.capacity || 1) * 2)),
          impact: {
            delayDays: Math.ceil(demand / (resource.capacity || 1) - 1) * 5, // Estimated delay
            affectedTasks,
            costIncrease: demand * 100
          },
          mitigation: {
            strategy: 'Add additional resources or redistribute workload',
            effort: demand > (resource.capacity || 1) * 2 ? 'high' : 'medium',
            effectiveness: 0.8
          }
        });
      }
    });

    return bottlenecks;
  }

  private identifyDependencyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const dependencyCount = new Map<string, number>();

    // Count dependencies for each task
    this.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          dependencyCount.set(depId, (dependencyCount.get(depId) || 0) + 1);
        });
      }
    });

    // Identify tasks with high dependency count (critical nodes)
    dependencyCount.forEach((count, taskId) => {
      if (count >= 3) { // Tasks that block 3 or more other tasks
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const dependentTasks = this.tasks.filter(t => t.dependencies?.includes(taskId)).map(t => t.id);
          
          bottlenecks.push({
            taskId,
            type: 'dependency',
            severity: Math.min(1, count / 10), // Normalize to 0-1 scale
            impact: {
              delayDays: count * 2, // Each dependent task adds potential delay
              affectedTasks: dependentTasks,
              costIncrease: count * 500
            },
            mitigation: {
              strategy: 'Parallelize dependent tasks or accelerate critical task',
              effort: count > 5 ? 'high' : 'medium',
              effectiveness: 0.7
            }
          });
        }
      }
    });

    return bottlenecks;
  }

  private identifyDurationBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const durations = this.tasks.map(task => task.endDate.getTime() - task.startDate.getTime());
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const stdDev = Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length);

    // Identify tasks with unusually long durations
    this.tasks.forEach(task => {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      if (duration > avgDuration + 2 * stdDev) { // More than 2 standard deviations above average
        const severity = Math.min(1, (duration - avgDuration) / (3 * stdDev));
        
        bottlenecks.push({
          taskId: task.id,
          type: 'duration',
          severity,
          impact: {
            delayDays: Math.ceil(duration / (1000 * 60 * 60 * 24)),
            affectedTasks: [task.id],
            costIncrease: severity * 1000
          },
          mitigation: {
            strategy: 'Break down task into smaller components or add resources',
            effort: severity > 0.7 ? 'high' : 'medium',
            effectiveness: 0.6
          }
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Task Aggregation by Time Window
   * Groups tasks and events by specified time windows for analysis
   */
  private aggregateByTimeWindow(windowSizeHours: number): TimeWindow[] {
    if (this.tasks.length === 0) return [];

    const windows: TimeWindow[] = [];
    const startTime = Math.min(...this.tasks.map(t => t.startDate.getTime()));
    const endTime = Math.max(...this.tasks.map(t => t.endDate.getTime()));
    const windowSizeMs = windowSizeHours * 60 * 60 * 1000;

    for (let current = startTime; current < endTime; current += windowSizeMs) {
      const windowStart = new Date(current);
      const windowEnd = new Date(current + windowSizeMs);

      // Find tasks that overlap with this window
      const windowTasks = this.tasks.filter(task =>
        this.dateRangesOverlap(
          { start: windowStart, end: windowEnd },
          { start: task.startDate, end: task.endDate }
        )
      );

      // Find events in this window
      const windowEvents = this.events.filter(event =>
        event.timestamp >= windowStart && event.timestamp < windowEnd
      );

      // Calculate resource utilization
      const resourceUtilization: Record<string, number> = {};
      windowTasks.forEach(task => {
        if (task.resourceId) {
          resourceUtilization[task.resourceId] = (resourceUtilization[task.resourceId] || 0) + 1;
        }
      });

      // Identify critical tasks in this window
      const criticalTasks = windowTasks
        .filter(task => this.criticalPath.find(cp => cp.taskId === task.id)?.isCritical)
        .map(task => task.id);

      windows.push({
        start: windowStart,
        end: windowEnd,
        taskCount: windowTasks.length,
        resourceUtilization,
        criticalTasks,
        events: windowEvents
      });
    }

    return windows.filter(window => window.taskCount > 0 || window.events.length > 0);
  }

  /**
   * Progress Metrics Calculation
   * Calculates various project performance metrics
   */
  private calculateProgressMetrics(): ProgressMetrics {
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgressTasks = this.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;

    // Basic progress calculation
    const overallProgress = totalTasks > 0 ? 
      (completedTasks * 100 + inProgressTasks * (this.tasks.find(t => t.status === TaskStatus.IN_PROGRESS)?.progress || 50)) / totalTasks : 0;

    // Earned Value Management calculations (simplified)
    const plannedValue = this.calculatePlannedValue();
    const earnedValue = (overallProgress / 100) * plannedValue;
    const actualCost = this.calculateActualCost();

    const spi = plannedValue > 0 ? earnedValue / plannedValue : 1;
    const cpi = actualCost > 0 ? earnedValue / actualCost : 1;

    const estimateAtCompletion = actualCost / cpi;
    const varianceAtCompletion = plannedValue - estimateAtCompletion;
    const scheduleVariance = earnedValue - plannedValue;
    const costVariance = earnedValue - actualCost;

    return {
      overallProgress,
      schedulePerformanceIndex: spi,
      costPerformanceIndex: cpi,
      earnedValue,
      plannedValue,
      actualCost,
      estimateAtCompletion,
      varianceAtCompletion,
      scheduleVariance,
      costVariance
    };
  }

  private calculatePlannedValue(): number {
    // Simplified calculation based on task count and estimated effort
    return this.tasks.length * 1000; // Arbitrary base value
  }

  private calculateActualCost(): number {
    // Simplified calculation - in real implementation, this would come from actual cost tracking
    const completedTasks = this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgressTasks = this.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    return completedTasks * 1200 + inProgressTasks * 600; // Overrun simulation
  }

  /**
   * Data Validation and Sanitization
   */
  private validateAndSanitizeInput(tasks: GanttTask[], resources: Resource[], events: MissionEvent[]): void {
    // Validate tasks
    if (!Array.isArray(tasks)) {
      throw new Error('Tasks must be an array');
    }

    tasks.forEach((task, index) => {
      if (!task.id || typeof task.id !== 'string') {
        throw new Error(`Task at index ${index} must have a valid string ID`);
      }
      if (!task.name || typeof task.name !== 'string') {
        throw new Error(`Task ${task.id} must have a valid name`);
      }
      if (!(task.startDate instanceof Date) || isNaN(task.startDate.getTime())) {
        throw new Error(`Task ${task.id} must have a valid start date`);
      }
      if (!(task.endDate instanceof Date) || isNaN(task.endDate.getTime())) {
        throw new Error(`Task ${task.id} must have a valid end date`);
      }
      if (task.startDate >= task.endDate) {
        throw new Error(`Task ${task.id} start date must be before end date`);
      }
      if (task.progress !== undefined && (task.progress < 0 || task.progress > 100)) {
        task.progress = Math.max(0, Math.min(100, task.progress));
      }
    });

    // Check for duplicate task IDs
    const taskIds = new Set<string>();
    tasks.forEach(task => {
      if (taskIds.has(task.id)) {
        throw new Error(`Duplicate task ID found: ${task.id}`);
      }
      taskIds.add(task.id);
    });

    // Validate resources
    if (!Array.isArray(resources)) {
      throw new Error('Resources must be an array');
    }

    resources.forEach((resource, index) => {
      if (!resource.id || typeof resource.id !== 'string') {
        throw new Error(`Resource at index ${index} must have a valid string ID`);
      }
      if (!resource.name || typeof resource.name !== 'string') {
        throw new Error(`Resource ${resource.id} must have a valid name`);
      }
    });

    // Validate events
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }

    events.forEach((event, index) => {
      if (!event.id || typeof event.id !== 'string') {
        throw new Error(`Event at index ${index} must have a valid string ID`);
      }
      if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
        throw new Error(`Event ${event.id} must have a valid timestamp`);
      }
    });
  }

  /**
   * Dependency Validation and Cycle Detection
   */
  private validateDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    this.tasks.forEach(task => {
      if (!visited.has(task.id)) {
        if (this.hasCyclicDependency(task.id, visited, recursionStack)) {
          throw new Error(`Cyclic dependency detected involving task: ${task.id}`);
        }
      }
    });

    // Validate dependency references
    this.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          if (!this.tasks.find(t => t.id === depId)) {
            console.warn(`Task ${task.id} references non-existent dependency: ${depId}`);
          }
        });
      }
    });
  }

  private hasCyclicDependency(taskId: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);

    const task = this.tasks.find(t => t.id === taskId);
    if (task && task.dependencies) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (this.hasCyclicDependency(depId, visited, recursionStack)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  /**
   * Timeline Compression and Expansion
   */
  public compressTimeline(compressionFactor: number): GanttTask[] {
    if (compressionFactor <= 0 || compressionFactor >= 1) {
      throw new Error('Compression factor must be between 0 and 1');
    }

    return this.tasks.map(task => {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      const newDuration = duration * compressionFactor;
      
      return {
        ...task,
        endDate: new Date(task.startDate.getTime() + newDuration)
      };
    });
  }

  public expandTimeline(expansionFactor: number): GanttTask[] {
    if (expansionFactor <= 1) {
      throw new Error('Expansion factor must be greater than 1');
    }

    return this.tasks.map(task => {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      const newDuration = duration * expansionFactor;
      
      return {
        ...task,
        endDate: new Date(task.startDate.getTime() + newDuration)
      };
    });
  }

  /**
   * Export Formatting
   */
  public exportData(format: ExportFormat): string | object {
    switch (format.format) {
      case 'json':
        return this.exportAsJSON(format.options);
      case 'csv':
        return this.exportAsCSV(format.options);
      case 'xml':
        return this.exportAsXML(format.options);
      case 'gantt':
        return this.exportAsGantt(format.options);
      default:
        throw new Error(`Unsupported export format: ${format.format}`);
    }
  }

  private exportAsJSON(options: ExportFormat['options']): object {
    const data: any = {
      tasks: this.tasks,
      metadata: {
        exportDate: new Date().toISOString(),
        taskCount: this.tasks.length,
        dateFormat: options.dateFormat || 'ISO'
      }
    };

    if (options.includeResources) {
      data.resources = this.resources;
    }

    if (options.includeDependencies) {
      data.dependencies = this.extractDependencyGraph();
    }

    if (options.includeProgress && this.criticalPath.length > 0) {
      data.criticalPath = this.criticalPath;
      data.statistics = this.calculateAdvancedStatistics();
    }

    return data;
  }

  private exportAsCSV(options: ExportFormat['options']): string {
    const headers = ['ID', 'Name', 'Start Date', 'End Date', 'Status', 'Progress', 'Priority'];
    if (options.includeResources) headers.push('Resource ID');
    if (options.includeDependencies) headers.push('Dependencies');

    const rows = [headers];

    this.tasks.forEach(task => {
      const row = [
        task.id,
        task.name,
        this.formatDate(task.startDate, options.dateFormat),
        this.formatDate(task.endDate, options.dateFormat),
        task.status || '',
        (task.progress || 0).toString(),
        task.priority || ''
      ];

      if (options.includeResources) {
        row.push(task.resourceId || '');
      }

      if (options.includeDependencies) {
        row.push((task.dependencies || []).join(';'));
      }

      rows.push(row);
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  private exportAsXML(options: ExportFormat['options']): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<project>\n';
    xml += `  <metadata>\n`;
    xml += `    <exportDate>${new Date().toISOString()}</exportDate>\n`;
    xml += `    <taskCount>${this.tasks.length}</taskCount>\n`;
    xml += `  </metadata>\n`;
    
    xml += '  <tasks>\n';
    this.tasks.forEach(task => {
      xml += `    <task id="${task.id}">\n`;
      xml += `      <name><![CDATA[${task.name}]]></name>\n`;
      xml += `      <startDate>${this.formatDate(task.startDate, options.dateFormat)}</startDate>\n`;
      xml += `      <endDate>${this.formatDate(task.endDate, options.dateFormat)}</endDate>\n`;
      xml += `      <status>${task.status || ''}</status>\n`;
      xml += `      <progress>${task.progress || 0}</progress>\n`;
      xml += `      <priority>${task.priority || ''}</priority>\n`;
      
      if (options.includeResources && task.resourceId) {
        xml += `      <resourceId>${task.resourceId}</resourceId>\n`;
      }
      
      if (options.includeDependencies && task.dependencies) {
        xml += '      <dependencies>\n';
        task.dependencies.forEach(dep => {
          xml += `        <dependency>${dep}</dependency>\n`;
        });
        xml += '      </dependencies>\n';
      }
      
      xml += '    </task>\n';
    });
    xml += '  </tasks>\n';
    xml += '</project>';

    return xml;
  }

  private exportAsGantt(options: ExportFormat['options']): object {
    // Microsoft Project-like format
    return {
      project: {
        name: 'Rover Mission Timeline',
        startDate: Math.min(...this.tasks.map(t => t.startDate.getTime())),
        endDate: Math.max(...this.tasks.map(t => t.endDate.getTime())),
        tasks: this.tasks.map((task, index) => ({
          id: index + 1,
          name: task.name,
          start: task.startDate.toISOString(),
          end: task.endDate.toISOString(),
          duration: Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)),
          progress: task.progress || 0,
          predecessors: task.dependencies?.map(dep => this.tasks.findIndex(t => t.id === dep) + 1).filter(i => i > 0) || [],
          resourceIds: task.resourceId ? [task.resourceId] : [],
          priority: task.priority,
          notes: task.metadata ? JSON.stringify(task.metadata) : ''
        })),
        resources: this.resources.map(resource => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          maxUnits: resource.capacity || 1
        }))
      }
    };
  }

  /**
   * Helper Methods
   */
  private calculateBasicStatistics(): TimelineStatistics {
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const overdueTasks = this.tasks.filter(t => 
      t.status !== TaskStatus.COMPLETED && t.endDate < new Date()
    ).length;

    const durations = this.tasks.map(t => t.endDate.getTime() - t.startDate.getTime());
    const averageTaskDuration = durations.length > 0 ? 
      durations.reduce((sum, d) => sum + d, 0) / durations.length / (1000 * 60 * 60 * 24) : 0;

    const resourceUtilization: Record<string, number> = {};
    this.resources.forEach(resource => {
      const tasksUsingResource = this.tasks.filter(t => t.resourceId === resource.id).length;
      resourceUtilization[resource.id] = tasksUsingResource / (resource.capacity || 1);
    });

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      averageTaskDuration,
      criticalPathLength: 0, // Will be updated after critical path calculation
      resourceUtilization,
      bottlenecks: []
    };
  }

  private calculateAdvancedStatistics(): TimelineStatistics {
    const basic = this.calculateBasicStatistics();
    
    return {
      ...basic,
      criticalPathLength: this.criticalPath.filter(cp => cp.isCritical).length,
      bottlenecks: this.bottlenecks.map(b => ({
        taskId: b.taskId,
        reason: `${b.type} bottleneck`,
        impact: b.severity > 0.7 ? 'high' : b.severity > 0.4 ? 'medium' : 'low'
      }))
    };
  }

  private dateRangesOverlap(range1: { start: Date; end: Date }, range2: { start: Date; end: Date }): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }

  private findOverlappingTasks(tasks: GanttTask[]): GanttTask[] {
    const overlapping: GanttTask[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        if (this.dateRangesOverlap(
          { start: tasks[i].startDate, end: tasks[i].endDate },
          { start: tasks[j].startDate, end: tasks[j].endDate }
        )) {
          if (!overlapping.includes(tasks[i])) overlapping.push(tasks[i]);
          if (!overlapping.includes(tasks[j])) overlapping.push(tasks[j]);
        }
      }
    }
    
    return overlapping;
  }

  private calculateConflictSeverity(tasks: GanttTask[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalTasks = tasks.filter(t => t.priority === Priority.CRITICAL).length;
    const highPriorityTasks = tasks.filter(t => t.priority === Priority.HIGH).length;
    
    if (criticalTasks > 0) return 'critical';
    if (highPriorityTasks > 1) return 'high';
    if (tasks.length > 3) return 'medium';
    return 'low';
  }

  private calculateScheduleDelay(tasks: GanttTask[]): number {
    // Calculate potential delay in days based on overlapping tasks
    const overlaps = tasks.length - 1; // Number of overlapping relationships
    return overlaps * 2; // Assume 2 days delay per overlap
  }

  private calculateOverlapDays(task1: GanttTask, task2: GanttTask): number {
    const overlapStart = new Date(Math.max(task1.startDate.getTime(), task2.startDate.getTime()));
    const overlapEnd = new Date(Math.min(task1.endDate.getTime(), task2.endDate.getTime()));
    return Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private extractDependencyGraph(): Array<{ from: string; to: string }> {
    const dependencies: Array<{ from: string; to: string }> = [];
    
    this.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          dependencies.push({ from: depId, to: task.id });
        });
      }
    });
    
    return dependencies;
  }

  private formatDate(date: Date, format?: string): string {
    switch (format) {
      case 'US':
        return date.toLocaleDateString('en-US');
      case 'EU':
        return date.toLocaleDateString('en-GB');
      case 'ISO':
      default:
        return date.toISOString();
    }
  }

  /**
   * Public API Methods for Timeline Manipulation
   */
  public getTasks(): GanttTask[] {
    return [...this.tasks];
  }

  public getCriticalPath(): CriticalPathNode[] {
    return [...this.criticalPath];
  }

  public getConflicts(): TaskConflict[] {
    return [...this.conflicts];
  }

  public getBottlenecks(): Bottleneck[] {
    return [...this.bottlenecks];
  }

  public getStatistics(): TimelineStatistics {
    return this.calculateAdvancedStatistics();
  }

  public addTask(task: GanttTask): void {
    this.validateAndSanitizeInput([task], [], []);
    this.tasks.push(task);
  }

  public updateTask(taskId: string, updates: Partial<GanttTask>): void {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
    this.validateAndSanitizeInput([this.tasks[taskIndex]], [], []);
  }

  public removeTask(taskId: string): void {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Remove task and clean up dependencies
    this.tasks.splice(taskIndex, 1);
    this.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies = task.dependencies.filter(depId => depId !== taskId);
      }
    });
  }

  public reset(): void {
    this.tasks = [];
    this.resources = [];
    this.events = [];
    this.criticalPath = [];
    this.conflicts = [];
    this.bottlenecks = [];
  }
}

// Export utility functions for standalone use
export const TimelineUtils = {
  /**
   * Calculate business days between two dates
   */
  calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  },

  /**
   * Generate color based on task priority
   */
  getPriorityColor(priority: Priority): string {
    const colors = {
      [Priority.CRITICAL]: '#ff4757',
      [Priority.HIGH]: '#ff6b6b',
      [Priority.MEDIUM]: '#ffa726',
      [Priority.LOW]: '#66bb6a'
    };
    return colors[priority] || colors[Priority.MEDIUM];
  },

  /**
   * Format duration in human-readable format
   */
  formatDuration(durationMs: number): string {
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  /**
   * Validate date range
   */
  isValidDateRange(startDate: Date, endDate: Date): boolean {
    return startDate instanceof Date && 
           endDate instanceof Date && 
           !isNaN(startDate.getTime()) && 
           !isNaN(endDate.getTime()) && 
           startDate < endDate;
  }
};

export default TimelineDataProcessor;