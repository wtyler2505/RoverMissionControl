/**
 * GridErrorBoundary Component - Error boundary for grid system
 * Provides graceful error handling and recovery options
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GridError } from '../../types/grid';

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
}

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  isolateErrors?: boolean;
}

class GridErrorBoundary extends Component<Props, State> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `grid-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Log error details
    console.error('Grid System Error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'GridErrorBoundary'
    });

    // Call external error handler
    this.props.onError?.(error, errorInfo);

    // Send to error reporting service (if configured)
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error state if props changed and resetOnPropsChange is enabled
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, this would send to an error reporting service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: 'rover-operator', // Would come from auth context
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      buildVersion: process.env.REACT_APP_VERSION || 'development',
      gridState: this.getGridStateSnapshot()
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Grid Error Report');
      console.error('Error:', error);
      console.info('Component Stack:', errorInfo.componentStack);
      console.info('Full Report:', errorReport);
      console.groupEnd();
    }

    // In production, send to error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    // errorReportingService.captureException(error, errorReport);
  };

  private getGridStateSnapshot = () => {
    try {
      // Attempt to get current grid state for debugging
      const gridState = localStorage.getItem('rover-grid-layout');
      return gridState ? JSON.parse(gridState) : null;
    } catch {
      return null;
    }
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
      retryCount: 0
    });
  };

  private retryOperation = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for grid error`);
      return;
    }

    // Add exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    const timeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
      this.retryTimeouts.delete(timeout);
    }, delay);

    this.retryTimeouts.add(timeout);
  };

  private renderErrorFallback = () => {
    const { error } = this.state;
    const { fallback } = this.props;

    if (fallback && error) {
      return fallback(error, this.retryOperation, this.resetErrorBoundary);
    }

    return this.renderDefaultErrorUI();
  };

  private renderDefaultErrorUI = () => {
    const { error, errorInfo, errorId, retryCount } = this.state;
    const { maxRetries = 3 } = this.props;

    return (
      <div className="grid-error-boundary" role="alert" aria-live="assertive">
        <div className="error-container">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          
          <div className="error-content">
            <h2 className="error-title">Grid System Error</h2>
            <p className="error-message">
              The grid layout encountered an unexpected error and needs to be reset.
            </p>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <div className="error-info">
                  <div className="error-section">
                    <h4>Error Message:</h4>
                    <code>{error.message}</code>
                  </div>
                  
                  {error.stack && (
                    <div className="error-section">
                      <h4>Stack Trace:</h4>
                      <pre className="error-stack">{error.stack}</pre>
                    </div>
                  )}
                  
                  {errorInfo?.componentStack && (
                    <div className="error-section">
                      <h4>Component Stack:</h4>
                      <pre className="error-component-stack">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                  
                  <div className="error-section">
                    <h4>Error ID:</h4>
                    <code>{errorId}</code>
                  </div>
                </div>
              </details>
            )}

            <div className="error-actions">
              {retryCount < maxRetries ? (
                <button
                  className="error-btn primary"
                  onClick={this.retryOperation}
                  type="button"
                >
                  Retry Operation ({maxRetries - retryCount} attempts left)
                </button>
              ) : (
                <p className="retry-exhausted">
                  Maximum retry attempts reached. Please reset the grid.
                </p>
              )}

              <button
                className="error-btn secondary"
                onClick={this.resetErrorBoundary}
                type="button"
              >
                Reset Grid
              </button>

              <button
                className="error-btn tertiary"
                onClick={() => {
                  localStorage.removeItem('rover-grid-layout');
                  window.location.reload();
                }}
                type="button"
              >
                Clear Data & Reload
              </button>
            </div>

            <div className="error-tips">
              <h4>Troubleshooting Tips:</h4>
              <ul>
                <li>Check browser console for additional error details</li>
                <li>Verify internet connection for real-time data</li>
                <li>Try refreshing the page if the error persists</li>
                <li>Contact mission control if issues continue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Accessibility announcements */}
        <div className="sr-only" aria-live="polite">
          Grid system error occurred. Use the reset button to restore functionality.
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

export default GridErrorBoundary;