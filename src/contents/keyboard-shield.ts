/**
 * Main-world content script that runs at document_start.
 *
 * Salesforce Lightning registers capture-phase keyboard listeners on `window`
 * before our extension's content scripts load. Because listeners fire in
 * registration order, Salesforce's handlers execute first and consume
 * keystrokes (e.g. 'e' triggers record edit, 'h' opens history).
 *
 * This script monkey-patches EventTarget.prototype.addEventListener so that
 * every keyboard listener registered by the PAGE is wrapped with a guard.
 * When the UltraForce modal is open (indicated by a data attribute on
 * <html>), the wrapped listeners return early, effectively disabling all
 * Salesforce keyboard shortcuts.
 *
 * Our extension's content scripts run in the ISOLATED world, which has its
 * own prototype chain, so the monkey-patch does NOT affect our own listeners.
 */
import type { PlasmoCSConfig } from 'plasmo'

export const config: PlasmoCSConfig = {
  world: 'MAIN',
  run_at: 'document_start',
  matches: [
    'https://*.salesforce.com/*',
    'https://*.visual.force.com/*',
    'https://*.visualforce.com/*',
    'https://*.lightning.force.com/*',
    'https://*.my.salesforce.com/*',
    'https://*.salesforce-setup.com/*',
    'https://*.force.com/*',
    'https://*.my.salesforce-sites.com/*',
    'https://*.salesforce-communities.com/*',
    'https://*.sandbox.my.salesforce.com/*',
    'https://*.scratch.my.salesforce.com/*',
    'https://*.sfcrmapps.cn/*',
    'https://*.lightning.sfcrmapps.cn/*',
    'https://*.visual.sfcrmapps.cn/*',
    'https://*.my.sfcrmapps.cn/*',
    'https://*.sandbox.my.sfcrmapps.cn/*',
    'https://*.sfcrmproducts.cn/*',
    'https://*.lightning.sfcrmproducts.cn/*',
    'https://*.visual.sfcrmproducts.cn/*',
    'https://*.my.sfcrmproducts.cn/*',
    'https://*.sandbox.my.sfcrmproducts.cn/*',
    'https://*.setup.sfcrmproducts.cn/*',
    'https://*.setup.sfcrmapps.cn/*'
  ]
}

const shieldWindow = window as Window & { __ultraForceKeyboardShield?: boolean }

// Tabs open before an extension update keep their previous shield until reloaded.
// 扩展更新前已打开的标签页会继续使用旧版键盘屏蔽，直到重新加载。
if (!shieldWindow.__ultraForceKeyboardShield) {
  shieldWindow.__ultraForceKeyboardShield = true
  const KEYBOARD_EVENTS = new Set(['keydown', 'keyup', 'keypress'])

  function isModalOpen(): boolean {
    return document.documentElement.hasAttribute('data-ultraforce-modal-open')
  }

  // Keep one wrapper per listener so native registration and removal share its identity.
  // 每个监听器保留一个包装函数，让原生注册和移除使用同一标识。
  const wrappedListeners = new WeakMap<EventListenerOrEventListenerObject, EventListener>()

  const origAdd = EventTarget.prototype.addEventListener
  const origRemove = EventTarget.prototype.removeEventListener

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (typeof type === 'symbol') return origAdd.call(this, type, listener, options)

    const eventType = String(type)
    if (
      !KEYBOARD_EVENTS.has(eventType) ||
      (typeof listener !== 'function' && typeof listener !== 'object') ||
      !listener
    ) {
      return origAdd.call(this, eventType, listener, options)
    }

    let wrapped = wrappedListeners.get(listener)
    if (!wrapped) {
      const original = listener
      wrapped = function (this: EventTarget, event: Event) {
        // A once listener is consumed even if the modal is open when it fires.
        // 即使事件触发时弹窗处于打开状态，once 监听器也会被消耗。
        if (isModalOpen()) return
        if (typeof original === 'function') {
          Reflect.apply(original, this, [event])
        } else {
          original.handleEvent(event)
        }
      }
      wrappedListeners.set(original, wrapped)
    }
    return origAdd.call(this, eventType, wrapped, options)
  }

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    if (typeof type === 'symbol') return origRemove.call(this, type, listener, options)

    const eventType = String(type)
    const wrapped = KEYBOARD_EVENTS.has(eventType) && listener ? wrappedListeners.get(listener) : undefined
    if (!wrapped) return origRemove.call(this, eventType, listener, options)

    // Reuse the capture flag for wrapped and raw registrations, reading any getter once.
    // 包装后的注册和原始注册使用同一捕获标志，且只调用一次 getter。
    const capture =
      options !== null && (typeof options === 'object' || typeof options === 'function')
        ? Boolean(options.capture)
        : options
    origRemove.call(this, eventType, wrapped, capture)
    return origRemove.call(this, eventType, listener, capture)
  }
}
