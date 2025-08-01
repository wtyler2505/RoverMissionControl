/**
 * Structured logging configuration for Rover Mission Control Frontend
 */

import { v4 as uuidv4 } from 'uuid';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  service: string;
  environment: string;
  log_level: string;
  message: string;
  module: string;
  correlation_id: string;
  user_id?: string;
  session_id?: string;
  browser_info: {
    userAgent: string;
    language: string;
    platform: string;
    screen: {
      width: number;
      height: number;
    };
  };
  page_info: {
    url: string;
    title: string;
    referrer: string;
  };
  [key: string]: any;
}

class StructuredLogger {
  private logLevel: LogLevel;
  private context: LogContext = {};
  private logBuffer: LogEntry[] = [];
  private flushInterval: number = 5000; // 5 seconds
  private maxBufferSize: number = 100;
  private logEndpoint: string;
  private fluentdEndpoint: string | null;

  constructor() {
    this.logLevel = this.getLogLevelFromEnv();
    this.logEndpoint = process.env.REACT_APP_LOG_ENDPOINT || '/api/logs';
    this.fluentdEndpoint = process.env.REACT_APP_FLUENTD_ENDPOINT || null;
    
    // Generate session ID
    this.context.sessionId = this.getOrCreateSessionId();
    
    // Setup periodic flush
    this.setupPeriodicFlush();
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());
    
    // Capture global errors
    this.setupGlobalErrorHandlers();
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.REACT_APP_LOG_LEVEL?.toUpperCase();
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'CRITICAL': return LogLevel.CRITICAL;
      default: return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('rover_session_id');
    if (stored) return stored;
    
    const sessionId = uuidv4();
    sessionStorage.setItem('rover_session_id', sessionId);
    return sessionId;
  }

  private setupPeriodicFlush(): void {
    setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private setupGlobalErrorHandlers(): void {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('Unhandled error', {
        error_message: event.message,
        error_file: event.filename,
        error_line: event.lineno,
        error_column: event.colno,
        error_stack: event.error?.stack
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        error_message: event.reason?.message || event.reason,
        error_stack: event.reason?.stack
      });
    });
  }

  private createLogEntry(level: string, message: string, extra: any = {}): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      service: 'frontend',
      environment: process.env.NODE_ENV || 'development',
      log_level: level,
      message,
      module: this.getCallerModule(),
      correlation_id: this.context.correlationId || uuidv4(),
      user_id: this.context.userId,
      session_id: this.context.sessionId,
      browser_info: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      },
      page_info: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer
      },
      ...extra
    };

    // Remove undefined values
    Object.keys(entry).forEach(key => {
      if (entry[key] === undefined) {
        delete entry[key];
      }
    });

    return entry;
  }

  private getCallerModule(): string {
    try {
      const stack = new Error().stack;
      if (!stack) return 'unknown';
      
      const lines = stack.split('\n');
      // Skip first 3 lines (Error, createLogEntry, log method)
      const callerLine = lines[3] || '';
      const match = callerLine.match(/at\s+(?:.*\s+\()?(.+?):\d+:\d+/);
      if (match && match[1]) {
        return match[1].replace(/^.*\//, ''); // Get filename only
      }
    } catch {
      // Ignore errors in stack parsing
    }
    return 'unknown';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const logs = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      // Send to backend logging endpoint
      await fetch(this.logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': this.context.correlationId || ''
        },
        body: JSON.stringify({ logs })
      });
    } catch (error) {
      console.error('Failed to send logs to backend:', error);
      // Re-add logs to buffer if send failed
      this.logBuffer.unshift(...logs);
    }
    
    // Send to Fluentd if configured
    if (this.fluentdEndpoint) {
      try {
        await fetch(this.fluentdEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logs)
        });
      } catch (error) {
        console.error('Failed to send logs to Fluentd:', error);
      }
    }
  }

  // Public methods

  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  setCorrelationId(correlationId: string): void {
    this.context.correlationId = correlationId;
  }

  setUserId(userId: string): void {
    this.context.userId = userId;
  }

  debug(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry('DEBUG', message, extra);
    console.debug(message, extra);
    this.addToBuffer(entry);
  }

  info(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry('INFO', message, extra);
    console.info(message, extra);
    this.addToBuffer(entry);
  }

  warn(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry('WARN', message, extra);
    console.warn(message, extra);
    this.addToBuffer(entry);
  }

  error(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry('ERROR', message, extra);
    console.error(message, extra);
    this.addToBuffer(entry);
  }

  critical(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.CRITICAL)) return;
    
    const entry = this.createLogEntry('CRITICAL', message, extra);
    console.error('[CRITICAL]', message, extra);
    this.addToBuffer(entry);
    
    // Immediately flush critical logs
    this.flush();
  }

  // Specialized logging methods

  logPerformance(metric: string, data: any): void {
    this.info('Performance metric', {
      performance_type: metric,
      ...data
    });
  }

  logUserAction(action: string, details?: any): void {
    this.info('User action', {
      user_action: action,
      action_details: details
    });
  }

  logApiCall(method: string, endpoint: string, status: number, duration: number, error?: any): void {
    const level = status >= 400 ? 'ERROR' : 'INFO';
    const entry = this.createLogEntry(level, `API ${method} ${endpoint}`, {
      api_method: method,
      api_endpoint: endpoint,
      api_status: status,
      api_duration_ms: duration,
      api_error: error
    });
    
    this.addToBuffer(entry);
  }

  logWebSocketEvent(event: string, data?: any): void {
    this.info('WebSocket event', {
      websocket_event: event,
      ws_data: data
    });
  }

  logTelemetry(type: string, data: any): void {
    this.info('Telemetry data', {
      telemetry_type: type,
      telemetry_data: data,
      ...data // Flatten telemetry values
    });
  }

  logComponentRender(component: string, renderTime: number, props?: any): void {
    this.debug('Component render', {
      component_name: component,
      render_time_ms: renderTime,
      component_props: props
    });
  }

  // React Error Boundary integration
  logReactError(error: Error, errorInfo: any): void {
    this.error('React component error', {
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
      error_boundary: true
    });
  }

  // Force flush all logs
  forceFlush(): Promise<void> {
    return this.flush();
  }
}

// Create singleton instance
const logger = new StructuredLogger();

// Export logger instance and types
export default logger;
export type { LogContext, LogEntry };

// React hooks for logging
export function useLogger() {
  return logger;
}

// HOC for component performance logging
export function withPerformanceLogging<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return (props: P) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const renderTime = performance.now() - startTime;
      logger.logComponentRender(componentName, renderTime, props);
    });
    
    return <Component {...props} />;
  };
}

// Axios interceptor for API logging
export function setupAxiosLogging(axios: any): void {
  // Request interceptor
  axios.interceptors.request.use(
    (config: any) => {
      config.metadata = { startTime: performance.now() };
      
      // Add correlation ID to headers
      if (logger['context'].correlationId) {
        config.headers['X-Correlation-ID'] = logger['context'].correlationId;
      }
      
      return config;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );
  
  // Response interceptor
  axios.interceptors.response.use(
    (response: any) => {
      const duration = performance.now() - response.config.metadata.startTime;
      logger.logApiCall(
        response.config.method.toUpperCase(),
        response.config.url,
        response.status,
        duration
      );
      
      // Update correlation ID if provided by server
      const correlationId = response.headers['x-correlation-id'];
      if (correlationId) {
        logger.setCorrelationId(correlationId);
      }
      
      return response;
    },
    (error: any) => {
      if (error.response) {
        const duration = performance.now() - error.config.metadata.startTime;
        logger.logApiCall(
          error.config.method.toUpperCase(),
          error.config.url,
          error.response.status,
          duration,
          {
            message: error.message,
            response_data: error.response.data
          }
        );
      } else {
        logger.error('API request failed', {
          method: error.config?.method,
          url: error.config?.url,
          error_message: error.message
        });
      }
      
      return Promise.reject(error);
    }
  );
}