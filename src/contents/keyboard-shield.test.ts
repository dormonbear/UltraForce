import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const nativeAdd = EventTarget.prototype.addEventListener
const nativeRemove = EventTarget.prototype.removeEventListener
const shieldWindow = window as Window & { __ultraForceKeyboardShield?: boolean }
const modalAttribute = 'data-ultraforce-modal-open'

beforeEach(async () => {
  vi.resetModules()
  await import('./keyboard-shield')
})

afterEach(() => {
  EventTarget.prototype.addEventListener = nativeAdd
  EventTarget.prototype.removeEventListener = nativeRemove
  delete shieldWindow.__ultraForceKeyboardShield
  document.documentElement.removeAttribute(modalAttribute)
})

it('dispatches duplicate keyboard registrations once / 重复注册的键盘监听器只调用一次', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  target.addEventListener('keydown', listener)
  target.addEventListener('keydown', listener, { capture: false })
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
})

it('removes the same listener independently on different targets / 可在不同目标上独立移除同一监听器', () => {
  const first = new EventTarget()
  const second = new EventTarget()
  const listener = vi.fn()
  first.addEventListener('keydown', listener)
  second.addEventListener('keydown', listener)

  first.removeEventListener('keydown', listener)
  first.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).not.toHaveBeenCalled()
  second.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
  second.removeEventListener('keydown', listener)
  second.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
})

it('removes both wrapped and raw keyboard registrations / 同时移除包装后的和原始的键盘监听器注册', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  target.addEventListener('keydown', listener, true)
  nativeAdd.call(target, 'keydown', listener, true)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledTimes(2)

  const capture = vi.fn(() => true)
  target.removeEventListener('keydown', listener, {
    get capture() {
      return capture()
    }
  })
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledTimes(2)
  expect(capture).toHaveBeenCalledOnce()
})

it('removes the same listener independently for each keyboard type / 可按键盘事件类型独立移除同一监听器', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  target.addEventListener('keydown', listener)
  target.addEventListener('keyup', listener)
  target.addEventListener('keypress', listener)

  target.removeEventListener('keyup', listener)
  target.dispatchEvent(new KeyboardEvent('keyup'))
  expect(listener).not.toHaveBeenCalled()
  for (const type of ['keydown', 'keypress']) {
    const event = new KeyboardEvent(type)
    target.dispatchEvent(event)
    expect(listener).toHaveBeenCalledExactlyOnceWith(event)
    target.removeEventListener(type, listener)
    listener.mockClear()
    target.dispatchEvent(new KeyboardEvent(type))
    expect(listener).not.toHaveBeenCalled()
  }
})

it('keeps capture and bubble registrations distinct / 分别保留捕获和冒泡注册', () => {
  const parent = document.createElement('div')
  const child = parent.appendChild(document.createElement('input'))
  const phases: number[] = []
  const listener = (event: Event) => phases.push(event.eventPhase)
  parent.addEventListener('keydown', listener, true)
  parent.addEventListener('keydown', listener)

  child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  expect(phases).toEqual([Event.CAPTURING_PHASE, Event.BUBBLING_PHASE])
  parent.removeEventListener('keydown', listener, { capture: true })
  phases.length = 0
  child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  expect(phases).toEqual([Event.BUBBLING_PHASE])
  parent.removeEventListener('keydown', listener)
  phases.length = 0
  child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  expect(phases).toEqual([])
})

it('preserves once across duplicate registration and re-registration / 重复注册及重新注册时保留 once 语义', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  target.addEventListener('keydown', listener, { once: true })
  target.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()

  target.addEventListener('keydown', listener, { once: true })
  target.dispatchEvent(new KeyboardEvent('keydown'))
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledTimes(2)
})

it('preserves abort behavior for duplicate and later registrations / 保留重复注册及后续注册的中止行为', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  const controller = new AbortController()
  target.addEventListener('keydown', listener, { signal: controller.signal })
  target.addEventListener('keydown', listener)
  controller.abort()
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).not.toHaveBeenCalled()

  target.addEventListener('keydown', listener, { signal: controller.signal })
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).not.toHaveBeenCalled()
  target.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
})

it('shields object listeners and preserves their receiver and removal / 屏蔽对象监听器并保留其 this 绑定和移除行为', () => {
  const target = new EventTarget()
  const listener = { handleEvent: vi.fn() }
  target.addEventListener('keydown', listener)
  target.addEventListener('keydown', listener)
  document.documentElement.setAttribute(modalAttribute, '')
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener.handleEvent).not.toHaveBeenCalled()

  document.documentElement.removeAttribute(modalAttribute)
  const event = new KeyboardEvent('keydown')
  target.dispatchEvent(event)
  expect(listener.handleEvent).toHaveBeenCalledExactlyOnceWith(event)
  expect(listener.handleEvent.mock.contexts).toEqual([listener])
  target.removeEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener.handleEvent).toHaveBeenCalledOnce()
})

it('passes non-keyboard callbacks through with their original identity / 以原始标识传递非键盘监听器', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  document.documentElement.setAttribute(modalAttribute, '')
  nativeAdd.call(target, 'click', listener)
  target.addEventListener('click', listener)
  const event = new MouseEvent('click')
  target.dispatchEvent(event)
  expect(listener).toHaveBeenCalledExactlyOnceWith(event)

  target.removeEventListener('click', listener)
  target.dispatchEvent(new MouseEvent('click'))
  expect(listener).toHaveBeenCalledOnce()
})

it('looks up a replaced handleEvent at dispatch time / 在事件派发时查找替换后的 handleEvent', () => {
  const target = new EventTarget()
  const original = vi.fn()
  const replacement = vi.fn()
  const listener = { handleEvent: original }
  target.addEventListener('keydown', listener)
  listener.handleEvent = replacement

  const event = new KeyboardEvent('keydown')
  target.dispatchEvent(event)
  expect(original).not.toHaveBeenCalled()
  expect(replacement).toHaveBeenCalledExactlyOnceWith(event)
  expect(replacement.mock.contexts).toEqual([listener])
})

it('ignores preventDefault in passive keyboard listeners / 被动键盘监听器中的 preventDefault 不生效', () => {
  const target = new EventTarget()
  const listener = vi.fn((event: Event) => event.preventDefault())
  target.addEventListener('keydown', listener, { passive: true })

  const event = new KeyboardEvent('keydown', { cancelable: true })
  expect(target.dispatchEvent(event)).toBe(true)
  expect(listener).toHaveBeenCalledExactlyOnceWith(event)
  expect(event.defaultPrevented).toBe(false)
})

it('shields and removes boxed keyboard event types / 对包装为对象的键盘事件类型执行屏蔽和移除', () => {
  const target = new EventTarget()
  const listener = vi.fn()
  const type = Object('keydown')
  Reflect.apply(target.addEventListener, target, [type, listener])

  document.documentElement.setAttribute(modalAttribute, '')
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).not.toHaveBeenCalled()

  document.documentElement.removeAttribute(modalAttribute)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
  Reflect.apply(target.removeEventListener, target, [type, listener])
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
})

it('preserves native rejection of Symbol event types / 保留原生接口对 Symbol 事件类型的拒绝行为', () => {
  const target = new EventTarget()
  const args = [Symbol('keydown'), vi.fn()]
  const typeError = expect.objectContaining({ name: 'TypeError' })
  expect(() => Reflect.apply(target.addEventListener, target, args)).toThrow(typeError)
  expect(() => Reflect.apply(target.removeEventListener, target, args)).toThrow(typeError)
})

it('keeps one keyboard wrapper across reinjection / 重新注入时沿用同一层键盘监听器包装', async () => {
  const shieldAdd = EventTarget.prototype.addEventListener
  const shieldRemove = EventTarget.prototype.removeEventListener
  expect(shieldAdd).not.toBe(nativeAdd)
  expect(shieldRemove).not.toBe(nativeRemove)

  const target = document.createElement('div')
  const listener = vi.fn()
  target.addEventListener('keydown', listener)

  vi.resetModules()
  await import('./keyboard-shield')
  expect(EventTarget.prototype.addEventListener).toBe(shieldAdd)
  expect(EventTarget.prototype.removeEventListener).toBe(shieldRemove)

  document.documentElement.setAttribute(modalAttribute, '')
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).not.toHaveBeenCalled()
  document.documentElement.removeAttribute(modalAttribute)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
  expect(listener.mock.contexts).toEqual([target])
  target.removeEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown'))
  expect(listener).toHaveBeenCalledOnce()
})
