import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('~lib/storage-service', () => ({
  storageSet: vi.fn().mockResolvedValue(undefined),
  storageRemove: vi.fn().mockResolvedValue(undefined),
  STORAGE_KEYS: { LEGACY_SETTINGS: 'settings' }
}))

// vitest-chrome does not provide chrome.action / chrome.commands; stub the
// listener registrations the module performs at import time. Runs before the
// module import below via vi.hoisted.
vi.hoisted(() => {
  const chromeAny = (globalThis as any).chrome
  chromeAny.runtime.id = 'fixture-extension'
  chromeAny.action = { onClicked: { addListener: () => {} } }
  chromeAny.commands = { onCommand: { addListener: () => {} } }
})

import { storageRemove, storageSet } from '~lib/storage-service'
import './index'

// vitest-chrome exposes a callListeners() helper that dispatches to every
// registered onMessage listener; the module registers its handler at import.
const SF_SENDER = { id: chrome.runtime.id, url: 'https://myorg.my.salesforce.com/lightning/page' }

function invoke(request: any, sender: Partial<chrome.runtime.MessageSender> = SF_SENDER): Promise<any> {
  return new Promise((resolve) => {
    const sendResponse = (response: any) => resolve(response)
    ;(chrome.runtime.onMessage as any).callListeners(request, { id: chrome.runtime.id, ...sender }, sendResponse)
  })
}

describe('background message handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.cookies.get.mockResolvedValue(null)
    chrome.cookies.getAll.mockResolvedValue([])
  })

  it('ping responds with success', async () => {
    const res = await invoke({ action: 'ping' })
    expect(res).toEqual({ success: true, message: 'Background script is running' })
  })

  it('unknown message responds with failure', async () => {
    const res = await invoke({ action: 'somethingElse' })
    expect(res).toEqual({ success: false, error: 'Unknown message' })
  })

  it('getSession returns key+hostname from the sid cookie', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'myorg.my.salesforce.com',
      value: 'SID_VALUE',
      name: 'sid'
    } as chrome.cookies.Cookie)
    const res = await invoke({ message: 'getSession', sfHost: 'myorg.my.salesforce.com' })
    expect(res).toEqual({ key: 'SID_VALUE', hostname: 'myorg.my.salesforce.com' })
    expect(chrome.cookies.get).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://myorg.my.salesforce.com', name: 'sid' })
    )
  })

  it('getSession returns null for a non-Salesforce sender url', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'myorg.my.salesforce.com',
      value: 'SID_VALUE',
      name: 'sid'
    } as chrome.cookies.Cookie)
    const res = await invoke(
      { message: 'getSession', sfHost: 'myorg.my.salesforce.com' },
      { url: 'https://evil.example.com/page' }
    )
    expect(res).toBeNull()
    expect(chrome.cookies.get).not.toHaveBeenCalled()
  })

  it('getSession returns null when the sender url is missing', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'myorg.my.salesforce.com',
      value: 'SID_VALUE',
      name: 'sid'
    } as chrome.cookies.Cookie)
    const res = await invoke({ message: 'getSession', sfHost: 'myorg.my.salesforce.com' }, {})
    expect(res).toBeNull()
  })

  it('getSession returns null when no sid cookie exists', async () => {
    chrome.cookies.get.mockResolvedValue(null)
    const res = await invoke({ message: 'getSession', sfHost: 'myorg.my.salesforce.com' })
    expect(res).toBeNull()
  })

  it('getSession checks the sfcrmproducts.cn domain first for sfcrmapps.cn hosts', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('sfcrmproducts.cn')) {
        return { domain: 'org.sfcrmproducts.cn', value: 'CN_SID', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke(
      { message: 'getSession', sfHost: 'org.sfcrmapps.cn' },
      { url: 'https://org.sfcrmapps.cn/' }
    )
    expect(res).toEqual({ key: 'CN_SID', hostname: 'org.sfcrmproducts.cn' })
  })

  it('getSfHost rejects an unrelated mcas.ms payload', async () => {
    const res = await invoke(
      { message: 'getSfHost', url: 'https://example.mcas.ms/page' },
      { url: 'https://example.mcas.ms/page' }
    )
    expect(res).toBeNull()
  })

  it('getSfHost maps salesforce-setup.com to my.salesforce.com when the sid cookie exists', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'acme.my.salesforce.com',
      value: 'x',
      name: 'sid'
    } as chrome.cookies.Cookie)
    const res = await invoke(
      { message: 'getSfHost', url: 'https://acme.my.salesforce-setup.com/setup' },
      { url: 'https://acme.my.salesforce-setup.com/setup' }
    )
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost falls back to the current domain when no sid cookie is found', async () => {
    chrome.cookies.get.mockResolvedValue(null)
    chrome.cookies.getAll.mockResolvedValue([])
    const res = await invoke(
      { message: 'getSfHost', url: 'https://acme.my.salesforce.com/page' },
      { url: 'https://acme.my.salesforce.com/page' }
    )
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost maps a China sfcrmproducts.cn setup domain to its my-domain', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme.my.sfcrmproducts.cn') {
        return { domain: 'acme.my.sfcrmproducts.cn', value: 'x', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke(
      { message: 'getSfHost', url: 'https://acme.setup.sfcrmproducts.cn/page' },
      { url: 'https://acme.setup.sfcrmproducts.cn/page' }
    )
    expect(res).toBe('acme.my.sfcrmproducts.cn')
  })

  it('getSfHost prefers a matching my-domain cookie sharing the org id', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme.lightning.force.com') {
        return {
          domain: 'acme.lightning.force.com',
          value: '00D000000000001!SID',
          name: 'sid'
        } as chrome.cookies.Cookie
      }
      if (url === 'https://acme.my.salesforce.com') {
        return {
          domain: 'acme.my.salesforce.com',
          value: '00D000000000001!OTHER',
          name: 'sid'
        } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke(
      { message: 'getSfHost', url: 'https://acme.lightning.force.com/page' },
      { url: 'https://acme.lightning.force.com/page' }
    )
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost discovers an org-linked legacy instance with getAll', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme--pkg.na99.visual.force.com' || url === 'https://na99.salesforce.com') {
        return { domain: new URL(url).hostname, value: '00D000000000001!SID', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    chrome.cookies.getAll.mockImplementation(async ({ domain }: { domain: string }) => {
      if (domain === 'salesforce.com') {
        return [{ domain: 'na99.salesforce.com', value: '00D000000000001!SID', name: 'sid' } as chrome.cookies.Cookie]
      }
      return []
    })
    const res = await invoke(
      { message: 'getSfHost', url: 'https://acme--pkg.na99.visual.force.com/page' },
      { url: 'https://acme--pkg.na99.visual.force.com/page' }
    )
    expect(res).toBe('na99.salesforce.com')
  })
})

describe('legacy diagnostic cleanup', () => {
  it.each(['install', 'update'])('removes only diagnostic keys on %s without reading values', async (reason) => {
    vi.clearAllMocks()
    ;(chrome.runtime.onInstalled as unknown as { callListeners: (details: { reason: string }) => void }).callListeners({
      reason
    })
    await vi.waitFor(() => {
      expect(storageRemove).toHaveBeenCalledWith(['ultraforce_error_logs', 'ultraforce_api_stats'])
    })
    expect(chrome.storage.local.get).not.toHaveBeenCalled()
    if (reason === 'update') expect(storageSet).not.toHaveBeenCalled()
  })

  it('cleans legacy keys on browser startup', async () => {
    vi.clearAllMocks()
    ;(chrome.runtime.onStartup as unknown as { callListeners: () => void }).callListeners()
    await vi.waitFor(() => {
      expect(storageRemove).toHaveBeenCalledWith(['ultraforce_error_logs', 'ultraforce_api_stats'])
    })
    expect(chrome.storage.local.get).not.toHaveBeenCalled()
  })
})
