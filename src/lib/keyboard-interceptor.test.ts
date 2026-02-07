import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createKeyboardInterceptor } from './keyboard-interceptor'

function createMockInput(value = '', selectionStart = 0, selectionEnd = 0): HTMLInputElement {
  const input = document.createElement('input')
  input.value = value
  input.selectionStart = selectionStart
  input.selectionEnd = selectionEnd
  // Track dispatched events
  const dispatched: Event[] = []
  const origDispatch = input.dispatchEvent.bind(input)
  input.dispatchEvent = (e: Event) => {
    dispatched.push(e)
    return origDispatch(e)
  }
  ;(input as any).__dispatched = dispatched
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
  // Make stopPropagation/stopImmediatePropagation/preventDefault spyable
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
    it('should intercept single character keydown and insert into input', () => {
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
      expect(input.selectionEnd).toBe(2)
    })

    it('should replace selected text when inserting character', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 0
      input.selectionEnd = 5

      const event = createKeyEvent('keydown', 'x')
      handler(event)

      expect(input.value).toBe('x')
      expect(input.selectionStart).toBe(1)
    })

    it('should insert character at the end', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'abc'
      input.selectionStart = 3
      input.selectionEnd = 3

      const event = createKeyEvent('keydown', 'd')
      handler(event)

      expect(input.value).toBe('abcd')
      expect(input.selectionStart).toBe(4)
    })

    it('should handle space character', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'ab'
      input.selectionStart = 2
      input.selectionEnd = 2

      const event = createKeyEvent('keydown', ' ')
      handler(event)

      expect(input.value).toBe('ab ')
      expect(input.selectionStart).toBe(3)
    })

    it('should handle uppercase characters via Shift', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = ''
      input.selectionStart = 0
      input.selectionEnd = 0

      const event = createKeyEvent('keydown', 'E', { shiftKey: true })
      handler(event)

      expect(input.value).toBe('E')
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should dispatch input event for React state sync', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = ''
      input.selectionStart = 0
      input.selectionEnd = 0

      const event = createKeyEvent('keydown', 'a')
      handler(event)

      const dispatched = (input as any).__dispatched as Event[]
      expect(dispatched.length).toBeGreaterThan(0)
      expect(dispatched.some((e: Event) => e.type === 'input')).toBe(true)
    })

    it('should block keyup/keypress for printable chars too', () => {
      const handler = createKeyboardInterceptor(getInput)

      const keyup = createKeyEvent('keyup', 'e')
      handler(keyup)
      expect(keyup.stopPropagation).toHaveBeenCalled()
      expect(keyup.stopImmediatePropagation).toHaveBeenCalled()

      const keypress = createKeyEvent('keypress', 'e')
      handler(keypress)
      expect(keypress.stopPropagation).toHaveBeenCalled()
      expect(keypress.stopImmediatePropagation).toHaveBeenCalled()
    })
  })

  describe('Backspace', () => {
    it('should delete character before cursor', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 3
      input.selectionEnd = 3

      const event = createKeyEvent('keydown', 'Backspace')
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).toHaveBeenCalled()
      expect(input.value).toBe('helo')
      expect(input.selectionStart).toBe(2)
    })

    it('should delete selected text', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 1
      input.selectionEnd = 4

      const event = createKeyEvent('keydown', 'Backspace')
      handler(event)

      expect(input.value).toBe('ho')
      expect(input.selectionStart).toBe(1)
    })

    it('should do nothing at position 0 with no selection', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 0
      input.selectionEnd = 0

      const event = createKeyEvent('keydown', 'Backspace')
      handler(event)

      expect(input.value).toBe('hello')
      expect(event.stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Delete key', () => {
    it('should delete character after cursor', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 2
      input.selectionEnd = 2

      const event = createKeyEvent('keydown', 'Delete')
      handler(event)

      expect(input.value).toBe('helo')
      expect(input.selectionStart).toBe(2)
    })

    it('should delete selected text', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hello'
      input.selectionStart = 0
      input.selectionEnd = 3

      const event = createKeyEvent('keydown', 'Delete')
      handler(event)

      expect(input.value).toBe('lo')
      expect(input.selectionStart).toBe(0)
    })

    it('should do nothing at end of string with no selection', () => {
      const handler = createKeyboardInterceptor(getInput)
      input.value = 'hi'
      input.selectionStart = 2
      input.selectionEnd = 2

      const event = createKeyEvent('keydown', 'Delete')
      handler(event)

      expect(input.value).toBe('hi')
    })
  })

  describe('Ctrl/Cmd + editing keys', () => {
    it('should stop propagation but NOT preventDefault for Ctrl+C', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'c', { ctrlKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should stop propagation but NOT preventDefault for Cmd+V', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'v', { metaKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should stop propagation but NOT preventDefault for Ctrl+A', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'a', { ctrlKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should stop propagation but NOT preventDefault for Ctrl+Z', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'z', { ctrlKey: true })
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should stop propagation but NOT preventDefault for Ctrl+X', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'x', { ctrlKey: true })
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
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should NOT intercept keyCode 229 (IME processing)', () => {
      const handler = createKeyboardInterceptor(getInput)

      const event = createKeyEvent('keydown', 'e', { keyCode: 229 } as any)
      handler(event)

      expect(event.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('navigation/function keys', () => {
    it.each(['Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Home', 'End'])(
      'should stop propagation for %s but NOT preventDefault',
      (key) => {
        const handler = createKeyboardInterceptor(getInput)
        const event = createKeyEvent('keydown', key)
        handler(event)

        expect(event.stopPropagation).toHaveBeenCalled()
        expect(event.stopImmediatePropagation).toHaveBeenCalled()
        // Do NOT preventDefault - let the event be re-dispatched to Shadow DOM
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
    it('should still block propagation even when input is not found', () => {
      const handler = createKeyboardInterceptor(() => null)

      const event = createKeyEvent('keydown', 'e')
      handler(event)

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
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
      const event = createKeyEvent('keydown', 'ArrowDown')
      handler(event)

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
      const dispatched = dispatchSpy.mock.calls[0][0] as KeyboardEvent
      expect(dispatched.key).toBe('ArrowDown')
      expect(dispatched.type).toBe('keydown')
    })

    it('should dispatch Escape to modal', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')
      const getModal = () => modalEl

      const handler = createKeyboardInterceptor(getInput, getModal)
      handler(createKeyEvent('keydown', 'Escape'))

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
      expect((dispatchSpy.mock.calls[0][0] as KeyboardEvent).key).toBe('Escape')
    })

    it('should dispatch Enter to modal', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')
      const getModal = () => modalEl

      const handler = createKeyboardInterceptor(getInput, getModal)
      handler(createKeyEvent('keydown', 'Enter'))

      expect(dispatchSpy).toHaveBeenCalledTimes(1)
    })

    it('should NOT re-dispatch for non-keydown events', () => {
      const modalEl = document.createElement('div')
      const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')
      const getModal = () => modalEl

      const handler = createKeyboardInterceptor(getInput, getModal)
      handler(createKeyEvent('keyup', 'Escape'))

      expect(dispatchSpy).not.toHaveBeenCalled()
    })
  })
})
