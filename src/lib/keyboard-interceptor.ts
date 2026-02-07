/**
 * Keyboard event interceptor for Shadow DOM input fields.
 *
 * Salesforce Lightning pages register capture-phase keyboard listeners
 * that consume keystrokes (e.g. 'e' triggers record edit). This module
 * intercepts events early, stops propagation to prevent Salesforce from
 * seeing them, and manually applies the edits to our input element.
 */

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

function insertText(input: HTMLInputElement, char: string): void {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  const before = input.value.slice(0, start)
  const after = input.value.slice(end)
  input.value = before + char + after
  const cursor = start + char.length
  input.selectionStart = cursor
  input.selectionEnd = cursor
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function deleteText(
  input: HTMLInputElement,
  direction: 'backward' | 'forward'
): void {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0

  if (start !== end) {
    const before = input.value.slice(0, start)
    const after = input.value.slice(end)
    input.value = before + after
    input.selectionStart = start
    input.selectionEnd = start
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  if (direction === 'backward') {
    if (start === 0) return
    const before = input.value.slice(0, start - 1)
    const after = input.value.slice(start)
    input.value = before + after
    input.selectionStart = start - 1
    input.selectionEnd = start - 1
  } else {
    if (start >= input.value.length) return
    const before = input.value.slice(0, start)
    const after = input.value.slice(start + 1)
    input.value = before + after
    input.selectionStart = start
    input.selectionEnd = start
  }

  input.dispatchEvent(new Event('input', { bubbles: true }))
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

    // Only modify input on keydown
    if (e.type !== 'keydown') return

    const input = getInput()
    if (!input) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      deleteText(input, 'backward')
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      deleteText(input, 'forward')
      return
    }

    if (isPrintable(e.key) && !hasCtrlOrCmd) {
      e.preventDefault()
      insertText(input, e.key)
    }
  }
}
