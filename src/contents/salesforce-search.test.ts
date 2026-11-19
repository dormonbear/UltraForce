import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { render, unmount } = vi.hoisted(() => ({ render: vi.fn(), unmount: vi.fn() }))
vi.mock('~lib/react-root', () => ({ createPrivateRoot: () => ({ render, unmount }) }))
vi.mock('~components/search/SearchModal', () => ({ default: () => null }))
vi.mock('~lib/auth', () => ({
  getSfHost: vi.fn().mockResolvedValue(null),
  getSession: vi.fn().mockResolvedValue(null)
}))

const runtime = chrome.runtime as Omit<typeof chrome.runtime, 'id'> & { id: string | undefined }
const messages = runtime.onMessage as typeof runtime.onMessage & {
  callListeners: (request: { action: string }, sender: object, respond: () => void) => void
  clearListeners: () => void
}

const modalSelector = '[id^="ultraforce-modal"]'

function shortcut(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event
}

async function loadContentScript(): Promise<void> {
  vi.resetModules()
  await import('./salesforce-search')
  await vi.waitFor(() => expect(messages.hasListeners()).toBe(true))
}

describe('search content script lifecycle / 搜索内容脚本生命周期', () => {
  beforeEach(() => {
    runtime.id = 'fixture-extension'
    vi.clearAllMocks()
  })

  afterEach(() => {
    window.dispatchEvent(new Event('beforeunload'))
    messages.clearListeners()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    runtime.id = undefined
    document.body.replaceChildren()
  })

  it('passes the first orphaned shortcut through and tears down once / 放行孤立脚本收到的首个快捷键并仅清理一次', async () => {
    await loadContentScript()
    shortcut()
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    const container = document.querySelector(modalSelector)
    const remove = vi.spyOn(container!, 'remove')
    const reachedPage = vi.fn()
    document.body.addEventListener('keydown', reachedPage, { once: true })

    vi.useFakeTimers()
    runtime.id = undefined
    expect(shortcut().defaultPrevented).toBe(false)
    expect(reachedPage).toHaveBeenCalledOnce()
    expect(shortcut().defaultPrevented).toBe(false)
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
    expect(unmount).toHaveBeenCalledOnce()
    expect(messages.hasListeners()).toBe(false)
    expect(document.querySelector(modalSelector)).toBeNull()
  })

  it('ignores messages after invalidation even when listener removal throws / 即使移除监听器抛出异常也忽略失效后的消息', async () => {
    await loadContentScript()
    const respond = vi.fn()
    const removeMessage = vi.spyOn(messages, 'removeListener')
    removeMessage.mockImplementationOnce(() => {
      throw new Error('Extension context invalidated')
    })

    vi.useFakeTimers()
    runtime.id = undefined
    messages.callListeners({ action: 'toggleModal' }, {}, respond)
    messages.callListeners({ action: 'ping' }, {}, respond)
    expect(respond).not.toHaveBeenCalled()
    expect(removeMessage).toHaveBeenCalledTimes(1)
    expect(render).not.toHaveBeenCalled()
    expect(document.querySelector(modalSelector)).toBeNull()
  })

  it('replaces stale containers and starts only once in a live context / 替换过期容器且在有效上下文中只启动一次', async () => {
    const stale = document.createElement('div')
    stale.id = 'ultraforce-modal-old'
    document.body.append(stale)

    const addMessage = vi.spyOn(messages, 'addListener')
    await loadContentScript()
    const container = document.querySelector(modalSelector)
    expect(stale.isConnected).toBe(false)
    expect(container).not.toBeNull()

    await loadContentScript()
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(addMessage).toHaveBeenCalledOnce()
    expect([...document.querySelectorAll(modalSelector)]).toEqual([container])
  })

  it('lets an orphan release its claim before taking over / 接管前让孤立脚本释放标记', async () => {
    const { claimExtensionScript } = await import('~lib/extension-context')
    const release = claimExtensionScript('search')!
    document.addEventListener('ultraforce:search-start', release, { once: true })
    try {
      await loadContentScript()
      expect(shortcut().defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    } finally {
      document.removeEventListener('ultraforce:search-start', release)
      if (!messages.hasListeners()) release()
    }
  })

  it('opens search before the legacy document shortcut runs / 在旧版文档快捷键监听器运行前打开搜索', async () => {
    const legacyShortcut = vi.fn()
    document.addEventListener('keydown', legacyShortcut, { capture: true, once: true })
    try {
      await loadContentScript()
      expect(shortcut().defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
      expect(legacyShortcut).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', legacyShortcut, true)
    }
  })

  it('closes an open legacy modal before removing its host / 移除旧版容器前关闭其已打开的对话框', async () => {
    const stale = document.createElement('div')
    stale.id = 'ultraforce-modal-old'
    const shadow = stale.attachShadow({ mode: 'closed' })
    const backdrop = document.createElement('div')
    backdrop.className = 'ultraforce-backdrop'
    const close = vi.fn(() => expect(stale.isConnected).toBe(true))
    const hostClick = vi.fn()
    backdrop.addEventListener('click', close)
    document.addEventListener('click', hostClick, { capture: true, once: true })
    shadow.append(backdrop)
    document.body.append(stale)

    vi.stubGlobal('chrome', { ...chrome, dom: { openOrClosedShadowRoot: () => shadow } })
    try {
      await loadContentScript()
      expect(close).toHaveBeenCalledOnce()
      expect(hostClick).not.toHaveBeenCalled()
      expect(stale.isConnected).toBe(false)
    } finally {
      document.removeEventListener('click', hostClick, true)
    }
  })

  it('suppresses the refresh notice if a replacement appears in time / 新实例及时接管时不显示刷新提示', async () => {
    await loadContentScript()
    vi.useFakeTimers()
    runtime.id = undefined
    expect(shortcut().defaultPrevented).toBe(false)

    const replacement = document.createElement('div')
    replacement.id = 'ultraforce-modal-replacement'
    document.body.append(replacement)
    await vi.advanceTimersByTimeAsync(150)
    expect([...document.querySelectorAll(modalSelector)]).toEqual([replacement])
  })

  it.each([
    ['en-US', 'UltraForce was updated', 'Refresh this page to keep using it.', 'Refresh'],
    ['zh-CN', 'UltraForce 已更新', '刷新此页面即可继续使用。', '刷新']
  ])('offers a localized page refresh in %s / 显示本地化刷新提示', async (locale, title, detail, action) => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    await loadContentScript()
    vi.useFakeTimers()
    runtime.id = undefined
    expect(shortcut().defaultPrevented).toBe(false)

    await vi.advanceTimersByTimeAsync(149)
    expect(document.querySelector(modalSelector)).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    const dialog = document.querySelector(modalSelector)?.shadowRoot?.querySelector('[role="alert"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.querySelector('h2')).toHaveTextContent(title)
    expect(dialog!.querySelector('p')).toHaveTextContent(detail)
    const button = dialog!.querySelector('button')!
    expect(button).toHaveTextContent(action)
    button.click()
    expect(reload).toHaveBeenCalledOnce()
  })
})
