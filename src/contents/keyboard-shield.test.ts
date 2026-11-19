import { expect, it, vi } from 'vitest'

it('keeps one keyboard wrapper across reinjection / 重新注入时沿用同一层键盘监听器包装', async () => {
  const nativeAdd = EventTarget.prototype.addEventListener
  const nativeRemove = EventTarget.prototype.removeEventListener
  try {
    await import('./keyboard-shield')
    const shieldAdd = EventTarget.prototype.addEventListener
    const shieldRemove = EventTarget.prototype.removeEventListener
    expect(shieldAdd).not.toBe(nativeAdd)

    vi.resetModules()
    await import('./keyboard-shield')
    expect(EventTarget.prototype.addEventListener).toBe(shieldAdd)
    expect(EventTarget.prototype.removeEventListener).toBe(shieldRemove)

    const target = document.createElement('div')
    const listener = vi.fn()
    target.addEventListener('keydown', listener)
    document.documentElement.setAttribute('data-ultraforce-modal-open', '')
    target.dispatchEvent(new KeyboardEvent('keydown'))
    expect(listener).not.toHaveBeenCalled()
    document.documentElement.removeAttribute('data-ultraforce-modal-open')
    target.dispatchEvent(new KeyboardEvent('keydown'))
    expect(listener).toHaveBeenCalledOnce()
    target.removeEventListener('keydown', listener)
    target.dispatchEvent(new KeyboardEvent('keydown'))
    expect(listener).toHaveBeenCalledOnce()
  } finally {
    EventTarget.prototype.addEventListener = nativeAdd
    EventTarget.prototype.removeEventListener = nativeRemove
    document.documentElement.removeAttribute('data-ultraforce-modal-open')
  }
})
