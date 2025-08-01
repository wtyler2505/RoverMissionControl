import React, { Component, ErrorInfo, ReactNode } from 'react';
import logger from '../utils/simpleLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to structured logging
    logger.logReactError(error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary-container p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-2xl font-bold text-red-800 mb-4">
            Something went wrong
          </h2>
          <p className="text-red-600 mb-4">
            An unexpected error occurred. The error has been logged and our team will investigate.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-red-700 font-semibold">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 p-4 bg-red-100 rounded overflow-auto text-sm">
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;