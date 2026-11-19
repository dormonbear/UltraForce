import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimExtensionScript, isExtensionContextValid } from './extension-context'

describe('extension context / 扩展上下文', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['live / 有效', 'fixture-extension', true],
    ['invalidated / 已失效', undefined, false]
  ])('checks the runtime ID for a %s context / 检查上下文的运行时 ID', (_name, id, valid) => {
    vi.stubGlobal('chrome', { runtime: { id } })
    expect(isExtensionContextValid()).toBe(valid)
  })

  it('claims independently by extension ID and version / 按扩展 ID 和版本分别认领', () => {
    const runtime = { id: 'fixture-extension', getManifest: () => ({ version: '0.6.0' }) }
    vi.stubGlobal('chrome', { runtime })
    const releaseOld = claimExtensionScript('search')
    try {
      expect(releaseOld).toBeTypeOf('function')
      expect(claimExtensionScript('search')).toBeUndefined()

      runtime.getManifest = () => ({ version: '0.6.1' })
      const releaseNew = claimExtensionScript('search')
      try {
        expect(releaseNew).toBeTypeOf('function')
        releaseOld?.()
        expect(claimExtensionScript('search')).toBeUndefined()

        runtime.id = 'other-extension'
        const releaseOther = claimExtensionScript('search')
        try {
          expect(releaseOther).toBeTypeOf('function')
        } finally {
          releaseOther?.()
        }
      } finally {
        releaseNew?.()
      }
    } finally {
      releaseOld?.()
    }
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
