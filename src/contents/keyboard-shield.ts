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

const KEYBOARD_EVENTS = new Set(['keydown', 'keyup', 'keypress'])

function isModalOpen(): boolean {
  return document.documentElement.hasAttribute('data-ultraforce-modal-open')
}

// Map original listeners to their wrapped counterparts for correct removal
const wrappedListeners = new WeakMap<Function, Function>()

const origAdd = EventTarget.prototype.addEventListener
const origRemove = EventTarget.prototype.removeEventListener

EventTarget.prototype.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions
) {
  if (KEYBOARD_EVENTS.has(type) && typeof listener === 'function') {
    const original = listener
    const wrapped = function (this: any, e: Event) {
      if (isModalOpen()) return
      return original.call(this, e)
    }
    wrappedListeners.set(original, wrapped)
    return origAdd.call(this, type, wrapped, options)
  }
  return origAdd.call(this, type, listener, options)
}

EventTarget.prototype.removeEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | EventListenerOptions
) {
  if (KEYBOARD_EVENTS.has(type) && typeof listener === 'function') {
    const wrapped = wrappedListeners.get(listener)
    if (wrapped) {
      wrappedListeners.delete(listener)
      return origRemove.call(this, type, wrapped as EventListener, options)
    }
  }
  return origRemove.call(this, type, listener, options)
}
