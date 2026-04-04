/**
 * Keyboard event interceptor for Shadow DOM input fields.
 *
 * Salesforce Lightning pages register capture-phase keyboard listeners
 * that consume keystrokes (e.g. 'e' triggers record edit, '/' opens search).
 * Some pages (Console App) register handlers BEFORE our content script,
 * meaning their handlers run first and may call preventDefault().
 *
 * Strategy:
 * 1. Intercept at window capture phase, call stopPropagation + preventDefault
 *    for printable characters/Backspace/Delete to block Salesforce
 * 2. Manually modify input.value
 * 3. Dispatch a custom 'ultraforce-input' event on the input element
 *    (bypasses React's event delegation which is unreliable in Shadow DOM)
 * 4. SearchInput listens for this custom event and calls onQueryChange directly
 */

import { logger } from './logger'

const MODIFIER_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'
])

const NAVIGATION_KEYS = new Set([
  'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight',
  'Enter', 'Tab', 'Home', 'End'
])

const EDITING_SHORTCUTS = new Set(['a', 'c', 'v', 'x', 'z'])

function isPrintable(key: string): boolean {
  return key.length === 1
}

function insertChar(input: HTMLInputElement, char: string): string {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  const before = input.value.slice(0, start)
  const after = input.value.slice(end)
  const newValue = before + char + after
  input.value = newValue
  const cursor = start + char.length
  input.selectionStart = cursor
  input.selectionEnd = cursor
  return newValue
}

function deleteChar(
  input: HTMLInputElement,
  direction: 'backward' | 'forward'
): string {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0

  if (start !== end) {
    const before = input.value.slice(0, start)
    const after = input.value.slice(end)
    input.value = before + after
    input.selectionStart = start
    input.selectionEnd = start
    return input.value
  }

  if (direction === 'backward') {
    if (start === 0) return input.value
    const before = input.value.slice(0, start - 1)
    const after = input.value.slice(start)
    input.value = before + after
    input.selectionStart = start - 1
    input.selectionEnd = start - 1
  } else {
    if (start >= input.value.length) return input.value
    const before = input.value.slice(0, start)
    const after = input.value.slice(start + 1)
    input.value = before + after
    input.selectionStart = start
    input.selectionEnd = start
  }

  return input.value
}

/**
 * Dispatch a custom event to notify SearchInput of the new value.
 * This bypasses React's event delegation system entirely.
 */
function notifyValueChange(input: HTMLInputElement, value: string): void {
  input.dispatchEvent(
    new CustomEvent('ultraforce-input', {
      detail: { value },
      bubbles: false
    })
  )
}

export function createKeyboardInterceptor(
  getInput: () => HTMLInputElement | null,
  getModal?: () => HTMLElement | null
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    // Never intercept IME composition
    if (e.isComposing || (e as any).keyCode === 229) return

    // Never intercept modifier-only keys
    if (MODIFIER_KEYS.has(e.key)) return

    const hasCtrlOrCmd = e.ctrlKey || e.metaKey

    // Ctrl/Cmd + editing shortcuts: stop propagation only (let browser handle)
    if (hasCtrlOrCmd && EDITING_SHORTCUTS.has(e.key.toLowerCase())) {
      e.stopPropagation()
      e.stopImmediatePropagation()
      return
    }

    // Navigation keys: stop propagation + re-dispatch to modal
    if (NAVIGATION_KEYS.has(e.key)) {
      e.stopPropagation()
      e.stopImmediatePropagation()
      // Tab must preventDefault to stop browser focus switching
      if (e.key === 'Tab') {
        e.preventDefault()
      }

      if (e.type === 'keydown' && getModal) {
        const modal = getModal()
        if (modal) {
          const clone = new KeyboardEvent(e.type, {
            key: e.key,
            code: e.code,
            bubbles: true,
            cancelable: true,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey
          })
          modal.dispatchEvent(clone)
        }
      }
      return
    }

    // Alt+key: stop propagation only
    if (e.altKey) {
      e.stopPropagation()
      e.stopImmediatePropagation()
      return
    }

    // Printable characters & Backspace/Delete: intercept fully
    e.stopPropagation()
    e.stopImmediatePropagation()
    e.preventDefault()

    // Only modify input on keydown
    if (e.type !== 'keydown') return

    const input = getInput()
    if (!input || input.value === undefined) {
      logger.debug('keyboard:no-input', { key: e.key, found: !!input })
      return
    }

    if (e.key === 'Backspace') {
      const newValue = deleteChar(input, 'backward')
      notifyValueChange(input, newValue)
      logger.debug('keyboard:backspace', { value: newValue })
      return
    }

    if (e.key === 'Delete') {
      const newValue = deleteChar(input, 'forward')
      notifyValueChange(input, newValue)
      logger.debug('keyboard:delete', { value: newValue })
      return
    }

    if (isPrintable(e.key) && !hasCtrlOrCmd) {
      const newValue = insertChar(input, e.key)
      notifyValueChange(input, newValue)
      logger.debug('keyboard:insert', { key: e.key, value: newValue })
    }
  }
}
