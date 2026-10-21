import React from 'react'
import { act } from '@testing-library/react'
import ErrorBoundary from '~components/ErrorBoundary'
import { createPrivateRoot } from './react-root'

it('keeps caught React errors out of console payloads while showing recovery UI', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createPrivateRoot(container)
  function ThrowingChild(): React.ReactNode {
    throw new Error('PRIVATE-RENDER-PAYLOAD')
  }
  try {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      )
    })
    expect(container.textContent).toContain('UltraForce encountered an error')
    expect(consoleError.mock.calls.length).toBeGreaterThan(0)
    for (const call of consoleError.mock.calls) {
      expect(call).toEqual(['[UltraForce] An operation failed.'])
    }
    expect(chrome.storage.local.set).not.toHaveBeenCalled()
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    consoleError.mockRestore()
  }
})
