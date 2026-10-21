import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInterFontFaces } from './font-loader'

describe('getInterFontFaces', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.getURL).mockImplementation((path: string) => `chrome-extension://abc123/${path}`)
  })

  it('resolves both font assets through chrome.runtime.getURL', () => {
    getInterFontFaces()
    expect(chrome.runtime.getURL).toHaveBeenCalledWith('assets/fonts/inter-latin-ext.woff2')
    expect(chrome.runtime.getURL).toHaveBeenCalledWith('assets/fonts/inter-latin.woff2')
  })

  it('emits two @font-face blocks for the Inter family', () => {
    const css = getInterFontFaces()
    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain("font-family: 'Inter';")
  })

  it('embeds the extension-resolved URLs as woff2 sources', () => {
    const css = getInterFontFaces()
    expect(css).toContain("src: url('chrome-extension://abc123/assets/fonts/inter-latin-ext.woff2') format('woff2');")
    expect(css).toContain("src: url('chrome-extension://abc123/assets/fonts/inter-latin.woff2') format('woff2');")
  })

  it('declares a variable weight range and swap display', () => {
    const css = getInterFontFaces()
    expect(css).toContain('font-weight: 300 600;')
    expect(css).toContain('font-display: swap;')
  })

  it('keeps the latin-ext and latin unicode ranges distinct', () => {
    const css = getInterFontFaces()
    expect(css).toContain('unicode-range: U+0100-02BA')
    expect(css).toContain('unicode-range: U+0000-00FF')
  })
})
