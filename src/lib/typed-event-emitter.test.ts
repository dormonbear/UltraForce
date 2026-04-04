import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TypedEventEmitter } from './typed-event-emitter'

vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

interface TestEvents {
  greet: string
  count: number
  data: { id: string; value: number }
}

describe('TypedEventEmitter', () => {
  let emitter: TypedEventEmitter<TestEvents>

  beforeEach(() => {
    emitter = new TypedEventEmitter<TestEvents>()
  })

  it('should call registered handler on emit', () => {
    const handler = vi.fn()
    emitter.on('greet', handler)
    emitter.emit('greet', 'hello')
    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('should remove handler with off', () => {
    const handler = vi.fn()
    emitter.on('greet', handler)
    emitter.off('greet', handler)
    emitter.emit('greet', 'hello')
    expect(handler).not.toHaveBeenCalled()
  })

  it('should fire multiple handlers on same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    emitter.on('count', handler1)
    emitter.on('count', handler2)
    emitter.emit('count', 42)
    expect(handler1).toHaveBeenCalledWith(42)
    expect(handler2).toHaveBeenCalledWith(42)
  })

  it('should not prevent other handlers from firing when one throws', () => {
    const handler1 = vi.fn(() => {
      throw new Error('handler error')
    })
    const handler2 = vi.fn()
    emitter.on('greet', handler1)
    emitter.on('greet', handler2)
    emitter.emit('greet', 'test')
    expect(handler2).toHaveBeenCalledWith('test')
  })

  it('should remove all handlers with clearAll', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    emitter.on('greet', handler1)
    emitter.on('count', handler2)
    emitter.clearAll()
    emitter.emit('greet', 'hello')
    emitter.emit('count', 1)
    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })

  it('should handle off for non-registered event gracefully', () => {
    const handler = vi.fn()
    expect(() => emitter.off('greet', handler)).not.toThrow()
  })

  it('should handle emit for non-registered event gracefully', () => {
    expect(() => emitter.emit('greet', 'hello')).not.toThrow()
  })

  it('should pass typed data correctly', () => {
    const handler = vi.fn()
    emitter.on('data', handler)
    emitter.emit('data', { id: 'abc', value: 99 })
    expect(handler).toHaveBeenCalledWith({ id: 'abc', value: 99 })
  })
})
