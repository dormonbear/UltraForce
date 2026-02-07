import React, { Component, ErrorInfo } from 'react'
import { logger } from '~lib/logger'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

/**
 * Error Boundary for UltraForce components
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: number | null = null
  
  constructor(props: ErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }
  
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    
    // Log to Chrome storage for debugging
    this.logErrorToStorage(error, errorInfo)
    
    // Auto-retry after 5 seconds
    this.scheduleRetry()
  }
  
  private async logErrorToStorage(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent
      }
      
      // Get existing error logs
      const result = await chrome.storage.local.get(['ultraforce_error_logs'])
      const existingLogs = result.ultraforce_error_logs || []
      
      // Add new error log (keep only last 10)
      const updatedLogs = [...existingLogs, errorLog].slice(-10)
      
      await chrome.storage.local.set({ ultraforce_error_logs: updatedLogs })
      
    } catch (storageError) {
      logger.error('Failed to log error to storage:', storageError)
    }
  }
  
  private scheduleRetry(): void {
    // Clear existing timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
    
    // Schedule retry in 5 seconds
    this.retryTimeout = setTimeout(() => {
      this.handleRetry()
    }, 5000) as any
  }
  
  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
  }
  
  private handleManualRetry = (): void => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
    this.handleRetry()
  }
  
  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Default fallback UI
      return (
        <div style={styles.errorContainer}>
          <div style={styles.errorCard}>
            <div style={styles.errorIcon}>!</div>
            <h2 style={styles.errorTitle}>UltraForce encountered an error</h2>
            <p style={styles.errorMessage}>
              Something went wrong while loading the search interface.
            </p>
            
            <div style={styles.errorDetails}>
              <details style={styles.detailsElement}>
                <summary style={styles.detailsSummary}>
                  Technical Details (Click to expand)
                </summary>
                <div style={styles.errorContent}>
                  <div style={styles.errorField}>
                    <strong>Error ID:</strong> {this.state.errorId}
                  </div>
                  <div style={styles.errorField}>
                    <strong>Message:</strong> {this.state.error?.message}
                  </div>
                  <div style={styles.errorField}>
                    <strong>Time:</strong> {new Date().toLocaleString()}
                  </div>
                  <div style={styles.errorField}>
                    <strong>URL:</strong> {window.location.href}
                  </div>
                  {this.state.error?.stack && (
                    <div style={styles.errorField}>
                      <strong>Stack Trace:</strong>
                      <pre style={styles.stackTrace}>
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
            
            <div style={styles.errorActions}>
              <button 
                onClick={this.handleManualRetry}
                style={styles.retryButton}
              >
                Try Again
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                style={styles.reloadButton}
              >
                Reload Page
              </button>
            </div>
            
            <p style={styles.autoRetryNote}>
              Auto-retry in 5 seconds...
            </p>
          </div>
        </div>
      )
    }
    
    return this.props.children
  }
}

// Styles for the error boundary UI
const styles = {
  errorContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
  },
  
  errorCard: {
    background: 'linear-gradient(145deg, #2d3142 0%, #4f5b7a 100%)',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center' as const,
    color: 'white'
  },
  
  errorIcon: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  
  errorTitle: {
    color: '#ff6b6b',
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 16px 0'
  },
  
  errorMessage: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.8)',
    margin: '0 0 24px 0',
    lineHeight: '1.5'
  },
  
  errorDetails: {
    marginBottom: '24px'
  },
  
  detailsElement: {
    textAlign: 'left' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  
  detailsSummary: {
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  errorContent: {
    padding: '16px',
    fontSize: '13px'
  },
  
  errorField: {
    marginBottom: '12px',
    wordBreak: 'break-all' as const
  },
  
  stackTrace: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '200px',
    marginTop: '8px'
  },
  
  errorActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  
  retryButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  
  reloadButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  
  autoRetryNote: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    margin: 0
  }
}

export default ErrorBoundary
export type { ErrorBoundaryProps, ErrorBoundaryState }
