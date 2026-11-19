import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reinjectContentScripts } from './reinject'

const search = { matches: ['https://*.salesforce.com/*'], js: ['search.js'] }
const shield = { matches: ['https://*.force.com/*'], js: ['shield.js', 'helper.js'], world: 'MAIN' }
const setup = { matches: ['https://*.salesforce-setup.com/*'], js: ['setup.js'], world: 'ISOLATED' }
const getManifest = vi.fn<() => Pick<chrome.runtime.Manifest, 'content_scripts'>>()
const getRegisteredContentScripts = vi.fn().mockResolvedValue([setup])
const query = vi.fn()
const executeScript = vi.fn()

describe('reinjecting content scripts / 重新注入内容脚本', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getManifest.mockReturnValue({ content_scripts: [search, shield] })
    getRegisteredContentScripts.mockResolvedValue([setup])
    query.mockImplementation(async ({ url }) => {
      if (url === search.matches) {
        return [{ id: 1 }, { id: 2 }, { id: 3, discarded: true }, { id: 4, status: 'unloaded' }, { id: -1 }, {}]
      }
      return [{ id: 5 }]
    })
    executeScript.mockImplementation(async ({ target }) => {
      if (target.tabId === 1) throw new Error('Tab closed / 标签页已关闭')
      return []
    })
    vi.stubGlobal('chrome', {
      runtime: { getManifest },
      tabs: { query },
      scripting: { executeScript, getRegisteredContentScripts }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(['install', 'update'] as const)(
    'reattaches scripts on %s and skips unloaded tabs / 在安装或更新时重新注入并跳过未加载的标签页',
    async (reason) => {
      await reinjectContentScripts(reason)

      expect(query.mock.calls).toEqual(
        expect.arrayContaining([[{ url: search.matches }], [{ url: shield.matches }], [{ url: setup.matches }]])
      )
      expect(executeScript.mock.calls).toEqual(
        expect.arrayContaining([
          [{ target: { tabId: 1 }, files: search.js, world: 'ISOLATED', injectImmediately: true }],
          [{ target: { tabId: 2 }, files: search.js, world: 'ISOLATED', injectImmediately: true }],
          [{ target: { tabId: 5 }, files: shield.js, world: 'MAIN', injectImmediately: true }],
          [{ target: { tabId: 5 }, files: setup.js, world: 'ISOLATED', injectImmediately: true }]
        ])
      )
      expect(executeScript).toHaveBeenCalledTimes(4)
    }
  )

  it.each(['chrome_update', 'shared_module_update'] as const)('ignores %s / 忽略此安装原因', async (reason) => {
    await reinjectContentScripts(reason)
    expect(getManifest).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('injects manifest scripts if dynamic lookup fails / 动态查询失败时仍注入清单脚本', async () => {
    getRegisteredContentScripts.mockRejectedValueOnce(new Error('Unavailable / 不可用'))
    await reinjectContentScripts('update')
    expect(executeScript).toHaveBeenCalledTimes(3)
  })

  it('injects registered scripts without manifest scripts / 清单无脚本时仍注入动态注册的脚本', async () => {
    getManifest.mockReturnValue({})
    await reinjectContentScripts('update')

    expect(query).toHaveBeenCalledExactlyOnceWith({ url: setup.matches })
    expect(executeScript).toHaveBeenCalledExactlyOnceWith({
      target: { tabId: 5 },
      files: setup.js,
      world: 'ISOLATED',
      injectImmediately: true
    })
  })

  it('skips CSS-only entries and continues after a tab query fails / 跳过仅含 CSS 的条目并在标签页查询失败后继续', async () => {
    getManifest.mockReturnValue({
      content_scripts: [search, { matches: ['https://*.visualforce.com/*'], css: ['styles.css'] }]
    })
    query.mockRejectedValueOnce(new Error('Tabs unavailable / 标签页不可用'))
    await reinjectContentScripts('update')

    expect(query.mock.calls).toEqual([[{ url: search.matches }], [{ url: setup.matches }]])
    expect(executeScript).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ files: setup.js }))
  })
})
