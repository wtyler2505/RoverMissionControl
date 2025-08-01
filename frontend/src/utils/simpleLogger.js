/**
 * Simple logger for build compatibility
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

class SimpleLogger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
  }

  debug(message, extra) {
    if (this.logLevel <= LOG_LEVELS.DEBUG) {
      console.debug(message, extra);
    }
  }

  info(message, extra) {
    if (this.logLevel <= LOG_LEVELS.INFO) {
      console.info(message, extra);
    }
  }

  warn(message, extra) {
    if (this.logLevel <= LOG_LEVELS.WARN) {
      console.warn(message, extra);
    }
  }

  error(message, extra) {
    if (this.logLevel <= LOG_LEVELS.ERROR) {
      console.error(message, extra);
    }
  }

  critical(message, extra) {
    if (this.logLevel <= LOG_LEVELS.CRITICAL) {
      console.error('[CRITICAL]', message, extra);
    }
  }

  // Specialized methods for compatibility
  logPerformance(metric, data) {
    this.info('Performance metric', { metric, ...data });
  }

  logUserAction(action, details) {
    this.info('User action', { action, details });
  }

  logApiCall(method, endpoint, status, duration, error) {
    const level = status >= 400 ? 'error' : 'info';
    this[level](`API ${method} ${endpoint}`, { status, duration, error });
  }

  logWebSocketEvent(event, data) {
    this.info('WebSocket event', { event, data });
  }

  logReactError(error, errorInfo) {
    this.error('React component error', { 
      message: error.message, 
      stack: error.stack,
      componentStack: errorInfo.componentStack 
    });
  }
}

const logger = new SimpleLogger();

// Export hooks for compatibility
export const useLogger = () => logger;

export const setupAxiosLogging = (axios) => {
  // Simplified axios logging
  if (axios.interceptors) {
    axios.interceptors.response.use(
      (response) => {
        logger.info(`API ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status
        });
        return response;
      },
      (error) => {
        logger.error(`API Error`, { 
          method: error.config?.method,
          url: error.config?.url,
          message: error.message 
        });
        return Promise.reject(error);
      }
    );
  }
};

export default logger;