import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createKeyboardInterceptor } from './keyboard-interceptor'

function createMockInput(value = '', selectionStart = 0, selectionEnd = 0): HTMLInputElement {
  const input = document.createElement('input')
  input.value = value
  input.selectionStart = selectionStart
  input.selectionEnd = selectionEnd
  return input
}

function createKeyEvent(
  type: string,
  key: string,
  opts: Partial<KeyboardEventInit> = {}
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...opts
  })
  vi.spyOn(event, 'stopPropagation')
  vi.spyOn(event, 'stopImmediatePropagation')
  vi.spyOn(event, 'preventDefault')
  return event
}

describe('createKeyboardInterceptor', () => {
  let input: HTMLInputElement
  let getInput: () => HTMLInputElement | null

  beforeEach(() => {
    input = createMockInput()
    getInput = () => input
  })

  describe('printable characters', () => {
    it('should intercept keydown, preventDefault, and insert character', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hllo'
      input.selectionStart = 1
      input.selectionEnd = 1

      const event = createKeyEvent('keydown', 'e')
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
      expect(event.preventDefault).toHaveBeenCalled()
      expect(input.value).toBe('hello')
      expect(input.selectionStart).toBe(2)
    })

    it('should replace selected text when inserting character', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 0
      input.selectionEnd = 5

      handler(createKeyEvent('keydown', 'x'))
      expect(input.value).toBe('x')
      expect(input.selectionStart).toBe(1)
    })

    it('should insert character at the end', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'abc'
      input.selectionStart = 3
      input.selectionEnd = 3

      handler(createKeyEvent('keydown', 'd'))
      expect(input.value).toBe('abcd')
      expect(input.selectionStart).toBe(4)
    })

    it('should handle space character', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'ab'
      input.selectionStart = 2
      input.selectionEnd = 2

      handler(createKeyEvent('keydown', ' '))
      expect(input.value).toBe('ab ')
    })

    it('should dispatch ultraforce-input custom event', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = ''
      input.selectionStart = 0
      input.selectionEnd = 0

      const customEventSpy = vi.fn()
      input.addEventListener('ultraforce-input', customEventSpy)

      handler(createKeyEvent('keydown', 'a'))

      expect(customEventSpy).toHaveBeenCalledTimes(1)
      const ce = customEventSpy.mock.calls[0][0] as CustomEvent
      expect(ce.detail.value).toBe('a')
    })

    it('should block keyup/keypress but not modify input', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'test'

      const keyup = createKeyEvent('keyup', 'e')
      handler(keyup)
      expect(keyup.stopPropagation).toHaveBeenCalled()
      expect(keyup.preventDefault).toHaveBeenCalled()
      expect(input.value).toBe('test') // unchanged

      const keypress = createKeyEvent('keypress', 'e')
      handler(keypress)
      expect(keypress.stopPropagation).toHaveBeenCalled()
      expect(input.value).toBe('test') // unchanged
    })
  })

  describe('Backspace', () => {
    it('should delete character before cursor', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 3
      input.selectionEnd = 3

      handler(createKeyEvent('keydown', 'Backspace'))
      expect(input.value).toBe('helo')
      expect(input.selectionStart).toBe(2)
    })

    it('should delete selected text', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 1
      input.selectionEnd = 4

      handler(createKeyEvent('keydown', 'Backspace'))
      expect(input.value).toBe('ho')
      expect(input.selectionStart).toBe(1)
    })

    it('should do nothing at position 0', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 0
      input.selectionEnd = 0

      handler(createKeyEvent('keydown', 'Backspace'))
      expect(input.value).toBe('hello')
    })

    it('should dispatch ultraforce-input event', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'ab'
      input.selectionStart = 2
      input.selectionEnd = 2

      const spy = vi.fn()
      input.addEventListener('ultraforce-input', spy)

      handler(createKeyEvent('keydown', 'Backspace'))
      expect(spy).toHaveBeenCalledTimes(1)
      expect((spy.mock.calls[0][0] as CustomEvent).detail.value).toBe('a')
    })
  })

  describe('Delete key', () => {
    it('should delete character after cursor', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 2
      input.selectionEnd = 2

      handler(createKeyEvent('keydown', 'Delete'))
      expect(input.value).toBe('helo')
      expect(input.selectionStart).toBe(2)
    })

    it('should do nothing at end of string', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hi'
      input.selectionStart = 2
      input.selectionEnd = 2

      handler(createKeyEvent('keydown', 'Delete'))
      expect(input.value).toBe('hi')
    })
  })

  describe('Ctrl/Cmd + editing keys', () => {
    it('should stop propagation but NOT preventDefault for Ctrl+C', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'c', { ctrlKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should stop propagation but NOT preventDefault for Cmd+V', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'v', { metaKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('IME composition', () => {
    it('should NOT intercept events during IME composition', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'e', { isComposing: true })
      handler(event)

      expect(event.stopPropagation).not.toHaveBeenCalled()
    })

    it('should NOT intercept keyCode 229', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'e', { keyCode: 229 } as any)
      handler(event)

      expect(event.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('navigation keys', () => {
    it.each(['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'])(
      'should stop propagation for %s but NOT preventDefault',
      (key) => {
        const handler = createKeyboardInterceptor(getInput)
        const event = createKeyEvent('keydown', key)
        handler(event)

        expect(event.stopPropagation).toHaveBeenCalled()
        expect(event.preventDefault).not.toHaveBeenCalled()
      }
    )
  })

  describe('modifier-only keys', () => {
    it.each(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])(
      'should NOT intercept modifier key %s',
      (key) => {
        const handler = createKeyboardInterceptor(getInput)
        const event = createKeyEvent('keydown', key)
        handler(event)

        expect(event.stopPropagation).not.toHaveBeenCalled()
      }
    )
  })

  describe('Alt+key combinations', () => {
    it('should stop propagation but NOT preventDefault for Alt+key', () => {
      const handler = createKeyboardInterceptor(getInput)
      const event = createKeyEvent('keydown', 'b', { altKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('null input', () => {
    it('should still block propagation when input is null', () => {
      const handler = createKeyboardInterceptor(() => null)

      const event = createKeyEvent('keydown', 'e')
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should not crash when input is null', () => {
      const handler = createKeyboardInterceptor(() => null)

      expect(() => {
        handler(createKeyEvent('keydown', 'Backspace'))
        handler(createKeyEvent('keydown', 'Delete'))
        handler(createKeyEvent('keydown', 'a'))
      }).not.toThrow()
    })
  })

  describe('re-dispatch to Shadow DOM', () => {
    it('should dispatch cloned event to modal for navigation keys', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')
      const getModal = () => modalEl

      const handler = createKeyboardInterceptor(getInput, getModal)
      handler(createKeyEvent('keydown', 'ArrowDown'))

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
      expect((dispatchSpy.mock.calls[0][0] as KeyboardEvent).key).toBe('ArrowDown')
    })

    it('should NOT re-dispatch for non-keydown events', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')

      const handler = createKeyboardInterceptor(getInput, () => modalEl)
      handler(createKeyEvent('keyup', 'Escape'))

      expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('should NOT re-dispatch printable chars to modal', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')

      const handler = createKeyboardInterceptor(getInput, () => modalEl)
      handler(createKeyEvent('keydown', 'a'))

      expect(dispatchSpy).not.toHaveBeenCalled()
    })
  })
})
