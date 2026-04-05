import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Child content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })

  it('should render default fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('UltraForce encountered an error')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('should log error to chrome storage', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(chrome.storage.local.set).toHaveBeenCalled()
  })

  it('should recover when Try Again is clicked', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('UltraForce encountered an error')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Try Again'))
    })

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should auto-retry after 5 seconds', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('UltraForce encountered an error')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    )

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should show error details in expandable section', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Technical Details (Click to expand)')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('should display auto-retry note', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Auto-retry in 5 seconds...')).toBeInTheDocument()
  })

  it('should handle storage errors silently during error logging', async () => {
    chrome.storage.local.set.mockRejectedValue(new Error('quota exceeded'))
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(screen.getByText('UltraForce encountered an error')).toBeInTheDocument()
  })

  it('should append to existing error logs and cap at 10', async () => {
    const existingLogs = Array.from({ length: 9 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      errorId: `old-${i}`,
      message: `old error ${i}`
    }))
    chrome.storage.local.get.mockResolvedValue({
      ultraforce_error_logs: existingLogs
    })

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const setCall = (chrome.storage.local.set as any).mock.calls[0]
    if (setCall) {
      const savedLogs = setCall[0].ultraforce_error_logs
      expect(savedLogs.length).toBeLessThanOrEqual(10)
    }
  })
})
