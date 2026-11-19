import { afterEach, describe, expect, it, vi } from 'vitest'
import { isExtensionContextValid } from './extension-context'

describe('extension context / 扩展上下文', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['live / 有效', 'fixture-extension', true],
    ['invalidated / 已失效', undefined, false]
  ])('checks the runtime ID for a %s context / 检查上下文的运行时 ID', (_name, id, valid) => {
    vi.stubGlobal('chrome', { runtime: { id } })
    expect(isExtensionContextValid()).toBe(valid)
  })

  it('handles a throwing runtime ID / 处理读取运行时 ID 时抛出的异常', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        get id() {
          throw new Error('Extension context invalidated')
        }
      }
    })
    expect(isExtensionContextValid()).toBe(false)
  })
})
