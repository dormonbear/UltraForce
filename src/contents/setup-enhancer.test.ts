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
    vi.useFakeTimers()
    observers = []
    getState.mockReturnValue({ autoLoadFields: true })
    document.body.innerHTML = ''
    installMutationObserverSpy()
    setLocation('https://example.salesforce-setup.com/lightning/setup/ObjectManager/Account/Details/view')
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    global.MutationObserver = RealMutationObserver
    vi.clearAllMocks()
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

  it('disconnects the duplicate observer on beforeunload', async () => {
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

    window.dispatchEvent(new Event('beforeunload'))
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
