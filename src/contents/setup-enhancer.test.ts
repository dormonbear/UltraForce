import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Logger is mocked so debug/error calls are silent and assertable.
vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

// Settings store is mocked so we control the autoLoadFields gate per-test.
const getState = vi.fn(() => ({ autoLoadFields: true }))
vi.mock('~stores/settings-store', () => ({
  useSettingsStore: { getState }
}))

/**
 * Captures every MutationObserver instance created while the module runs so a
 * test can synchronously trigger the observed callback (jsdom won't fire it
 * for synthetic mutations within the same tick reliably).
 */
interface CapturedObserver {
  callback: MutationCallback
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  observedTargets: Node[]
}

let observers: CapturedObserver[] = []
let RealMutationObserver: typeof MutationObserver
const detailsUrl = 'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/Details/view'
const fieldsUrl =
  'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'

function installMutationObserverSpy(): void {
  RealMutationObserver = global.MutationObserver
  class SpyObserver {
    callback: MutationCallback
    observe = vi.fn((target: Node) => {
      this.observedTargets.push(target)
    })
    disconnect = vi.fn()
    observedTargets: Node[] = []
    takeRecords = vi.fn(() => [])
    constructor(cb: MutationCallback) {
      this.callback = cb
      observers.push(this as unknown as CapturedObserver)
    }
  }
  global.MutationObserver = SpyObserver as unknown as typeof MutationObserver
}

/**
 * Sets location.href and pathname so the module's URL reads resolve. jsdom's
 * default location is about:blank; we redefine it with a real URL object.
 */
function setLocation(href: string): void {
  const url = new URL(href)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: url.href,
      origin: url.origin,
      pathname: url.pathname,
      assign: vi.fn()
    }
  })
}

/**
 * Imports the side-effect-only module fresh so its top-level instantiation of
 * SetupEnhancer re-runs against the current DOM, settings, and observer spy.
 */
async function loadModule(): Promise<void> {
  vi.resetModules()
  await import('./setup-enhancer')
}

describe('setup-enhancer', () => {
  beforeEach(() => {
    Object.assign(chrome.runtime, { id: 'fixture-extension' })
    vi.useFakeTimers()
    observers = []
    getState.mockReturnValue({ autoLoadFields: true })
    document.body.innerHTML = ''
    installMutationObserverSpy()
    setLocation(detailsUrl)
  })

  afterEach(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    global.MutationObserver = RealMutationObserver
    vi.clearAllMocks()
  })

  it('starts pending scrolling after canceled navigation / 取消导航后仍会启动待执行的滚动', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()
    window.addEventListener('beforeunload', (event) => event.preventDefault(), { once: true })
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(container.scrollTopWrites).toEqual([1000])
  })

  it('keeps pending scrolling and one watcher on cache restore / 恢复缓存后保留待执行滚动和一个 URL 观察器', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await vi.advanceTimersByTimeAsync(2000)

    expect(container.scrollTopWrites).toEqual([1000])
    expect(observers).toHaveLength(1)
    expect(observers[0].disconnect).not.toHaveBeenCalled()
  })

  it('does not start Setup after discard before DOM readiness / 等待 DOM 就绪期间丢弃页面后不会启动设置增强', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    try {
      await loadModule()
      window.dispatchEvent(new PageTransitionEvent('pagehide'))
      document.dispatchEvent(new Event('DOMContentLoaded'))
      expect(observers).toHaveLength(0)
    } finally {
      readyState.mockRestore()
    }
  })

  it('cancels scheduled Setup scrolling on discard / 丢弃页面时取消待执行的设置页滚动', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()

    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    await vi.advanceTimersByTimeAsync(5000)

    expect(container.scrollTopWrites).toEqual([])
  })

  it('sets up a URL watcher observing document.body when autoLoadFields is enabled', async () => {
    await loadModule()

    expect(getState).toHaveBeenCalled()
    // One observer is the URL watcher; it must observe document.body.
    expect(observers.length).toBeGreaterThanOrEqual(1)
    const urlWatcher = observers[0]
    expect(urlWatcher.observe).toHaveBeenCalled()
    expect(urlWatcher.observedTargets).toContain(document.body)
  })

  it('starts only one URL watcher when reinjected / 重复注入时只启动一个 URL 观察器', async () => {
    await loadModule()
    await loadModule()

    expect(observers).toHaveLength(1)
  })

  it('lets the orphaned setup enhancer release its claim on same-version reload / 同版本重载时让孤立的设置增强脚本释放标记', async () => {
    const { claimExtensionScript } = await import('~lib/extension-context')
    const release = vi.fn(claimExtensionScript('setup-enhancer')!)
    document.addEventListener('ultraforce:setup-start', release, { once: true })
    try {
      await loadModule()
      expect(release).toHaveBeenCalledOnce()
      expect(observers).toHaveLength(1)
    } finally {
      document.removeEventListener('ultraforce:setup-start', release)
      if (!release.mock.calls.length) release()
    }
  })

  it('does nothing when autoLoadFields is disabled', async () => {
    getState.mockReturnValue({ autoLoadFields: false })

    await loadModule()

    expect(observers.length).toBe(0)
  })

  it('does not auto-load on a non-Fields page', async () => {
    await loadModule()
    // initialize() calls checkAndEnhancePage synchronously; current URL is a
    // Details page, so no autoLoad timer should be scheduled.
    const container = makeScrollContainer()
    document.body.appendChild(container)

    vi.advanceTimersByTime(5000)

    expect(container.scrollTop).toBe(0)
    expect(container.scrollHeightReads).toBe(0)
  })

  it('auto-loads content on a FieldsAndRelationships page by scrolling the container', async () => {
    setLocation(
      'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'
    )
    const container = makeScrollContainer()
    document.body.appendChild(container)

    await loadModule()

    // checkAndEnhancePage schedules autoLoadAllContent after 2000ms.
    await vi.advanceTimersByTimeAsync(2000)
    // The scroll loop waits 500ms between attempts; with a stable height it
    // stops after 3 identical reads. Drain enough timer cycles.
    await vi.advanceTimersByTimeAsync(500 * 6)

    // It scrolled to the bottom at least once then reset to top.
    expect(container.scrollTopWrites).toContain(container.scrollHeight)
    expect(container.scrollTop).toBe(0)
  })

  it('re-runs enhancement when the URL changes via the body MutationObserver', async () => {
    const container = makeScrollContainer()
    document.body.appendChild(container)

    await loadModule()
    const urlWatcher = observers[0]

    // Navigate to a Fields page and fire the observed body mutation.
    setLocation(
      'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'
    )
    urlWatcher.callback([], urlWatcher as unknown as MutationObserver)

    // setupUrlWatcher waits 1000ms before checkAndEnhancePage, which then
    // waits 2000ms before autoLoadAllContent.
    await vi.advanceTimersByTimeAsync(1000 + 2000)
    await vi.advanceTimersByTimeAsync(500 * 6)

    expect(container.scrollTopWrites).toContain(container.scrollHeight)
  })

  it('does not re-run enhancement when the body mutates without a URL change', async () => {
    setLocation(
      'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'
    )
    const container = makeScrollContainer()
    document.body.appendChild(container)

    await loadModule()
    const urlWatcher = observers[0]

    // First load completes and records the URL as done.
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(500 * 6)
    const writesAfterFirst = container.scrollTopWrites.length

    // Same URL, fire mutation again: completedUrls guard skips re-processing.
    urlWatcher.callback([], urlWatcher as unknown as MutationObserver)
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 500 * 6)

    expect(container.scrollTopWrites.length).toBe(writesAfterFirst)
  })

  it('re-runs enhancement on popstate navigation', async () => {
    await loadModule()

    setLocation(
      'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'
    )
    const container = makeScrollContainer()
    document.body.appendChild(container)

    window.dispatchEvent(new Event('popstate'))
    await vi.advanceTimersByTimeAsync(1000 + 2000)
    await vi.advanceTimersByTimeAsync(500 * 6)

    expect(container.scrollTopWrites).toContain(container.scrollHeight)
  })

  it('cancels a pending start when navigating away / 离开页面时取消待执行的滚动', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()

    await vi.advanceTimersByTimeAsync(1000)
    setLocation(detailsUrl)
    window.dispatchEvent(new Event('popstate'))
    await vi.advanceTimersByTimeAsync(5000)

    expect(container.scrollTopWrites).toEqual([])
    expect(observers).toHaveLength(1)
  })

  it('retries an interrupted auto-load on return / 返回页面后重试被中断的自动加载', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()

    await vi.advanceTimersByTimeAsync(2000)
    expect(container.scrollTopWrites).toEqual([1000])
    setLocation(detailsUrl)
    window.dispatchEvent(new Event('popstate'))
    await vi.advanceTimersByTimeAsync(3000)
    expect(container.scrollTopWrites).toEqual([1000])
    expect(observers).toHaveLength(1)

    setLocation(fieldsUrl)
    window.dispatchEvent(new Event('popstate'))
    await vi.advanceTimersByTimeAsync(3000)
    expect(container.scrollTopWrites).toEqual([1000, 1000])
    await vi.advanceTimersByTimeAsync(2000)
    expect(container.scrollTop).toBe(0)
    expect(observers[1].observedTargets).toContain(container)
  })

  it('disconnects the completed run’s duplicate observer on SPA navigation / 单页导航时断开已完成任务的去重观察器', async () => {
    setLocation(fieldsUrl)
    const container = makeScrollContainer()
    document.body.append(container)
    await loadModule()
    await vi.advanceTimersByTimeAsync(4000)
    const [urlWatcher, duplicateObserver] = observers
    expect(duplicateObserver.observedTargets).toContain(container)

    setLocation(detailsUrl)
    urlWatcher.callback([], urlWatcher as unknown as MutationObserver)

    expect(duplicateObserver.disconnect).toHaveBeenCalledOnce()
    expect(urlWatcher.disconnect).not.toHaveBeenCalled()
  })

  it('disconnects the duplicate observer on discard / 丢弃页面时断开去重观察器', async () => {
    setLocation(
      'https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view'
    )
    const container = makeScrollContainer()
    document.body.appendChild(container)

    await loadModule()
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(500 * 6)

    // After auto-load a duplicate-removal observer is attached (the 2nd+).
    const duplicateObserver = observers[observers.length - 1]
    expect(duplicateObserver.observe).toHaveBeenCalled()

    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    expect(duplicateObserver.disconnect).toHaveBeenCalled()
  })
})

/**
 * Builds a fake scroll container matching the module's first selector
 * (.viewport.scroller) where scrollHeight exceeds clientHeight so
 * findScrollContainer selects it. scrollTop reads/writes are recorded since
 * jsdom does not implement scrolling.
 */
interface FakeScrollContainer extends HTMLDivElement {
  scrollTopWrites: number[]
  scrollHeightReads: number
}

function makeScrollContainer(): FakeScrollContainer {
  const el = document.createElement('div') as FakeScrollContainer
  el.className = 'viewport scroller'
  el.scrollTopWrites = []
  el.scrollHeightReads = 0
  let scrollTopValue = 0

  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get() {
      el.scrollHeightReads++
      return 1000
    }
  })
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => 300
  })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTopValue,
    set(v: number) {
      scrollTopValue = v
      el.scrollTopWrites.push(v)
    }
  })

  return el
}
