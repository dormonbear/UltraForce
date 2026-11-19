import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAnimatedHeight } from './useAnimatedHeight'

afterEach(() => vi.unstubAllGlobals())

it('updates the outer height when the inner height changes / 内层高度变化时更新外层高度', () => {
  let notify: () => void = () => {}
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
    }
  )

  function Panel() {
    const { innerRef, height } = useAnimatedHeight()
    return (
      <div data-testid="outer" style={{ height }}>
        <div data-testid="inner" ref={innerRef} />
      </div>
    )
  }

  const { getByTestId, unmount } = render(<Panel />)
  const inner = getByTestId('inner')
  expect(observe).toHaveBeenCalledWith(inner)
  for (const height of [180, 240]) {
    Object.defineProperty(inner, 'offsetHeight', { configurable: true, value: height })
    act(notify)
    expect(getByTestId('outer')).toHaveStyle({ height: `${height}px` })
  }
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
