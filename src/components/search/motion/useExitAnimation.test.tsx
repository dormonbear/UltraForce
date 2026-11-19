import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useExitAnimation } from './useExitAnimation'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('CSS', { supports: () => true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('delays closing by 140 ms / 延迟 140 毫秒关闭', () => {
  const onClose = vi.fn()
  const { result } = renderHook(() => useExitAnimation(onClose))
  act(() => void result.current.close())
  expect(result.current.closing).toBe(true)
  act(() => vi.advanceTimersByTime(139))
  expect(onClose).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(onClose).toHaveBeenCalledOnce()
})

it('cancels a pending close on reopen / 重新打开时取消待执行的关闭', async () => {
  const onClose = vi.fn()
  const { result } = renderHook(() => useExitAnimation(onClose))
  let pending: Promise<void> | undefined
  act(() => {
    pending = result.current.close()
    expect(result.current.cancel()).toBe(true)
  })
  act(() => vi.advanceTimersByTime(140))
  await pending
  expect(result.current.closing).toBe(false)
  expect(onClose).not.toHaveBeenCalled()
})

it.each(['reduced', 'unsupported'])('closes with zero delay in %s mode / 此模式下立即关闭', (mode) => {
  vi.stubGlobal('matchMedia', () => ({ matches: mode === 'reduced' }))
  vi.stubGlobal('CSS', { supports: () => mode !== 'unsupported' })
  const onClose = vi.fn()
  const { result } = renderHook(() => useExitAnimation(onClose))
  act(() => void result.current.close())
  expect(onClose).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
