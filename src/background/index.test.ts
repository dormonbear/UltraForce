import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('~lib/storage-service', () => ({
  storageSet: vi.fn().mockResolvedValue(undefined),
  STORAGE_KEYS: { LEGACY_SETTINGS: 'settings' }
}))

// vitest-chrome does not provide chrome.action / chrome.commands; stub the
// listener registrations the module performs at import time. Runs before the
// module import below via vi.hoisted.
vi.hoisted(() => {
  const chromeAny = (globalThis as any).chrome
  chromeAny.action = { onClicked: { addListener: () => {} } }
  chromeAny.commands = { onCommand: { addListener: () => {} } }
})

import './index'

// vitest-chrome exposes a callListeners() helper that dispatches to every
// registered onMessage listener; the module registers its handler at import.
const SF_SENDER = { url: 'https://myorg.my.salesforce.com/lightning/page' }

function invoke(
  request: any,
  sender: Partial<chrome.runtime.MessageSender> = SF_SENDER
): Promise<any> {
  return new Promise((resolve) => {
    const sendResponse = (response: any) => resolve(response)
    ;(chrome.runtime.onMessage as any).callListeners(request, sender, sendResponse)
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
    const res = await invoke({ message: 'getSession', sfHost: 'org.sfcrmapps.cn' })
    expect(res).toEqual({ key: 'CN_SID', hostname: 'org.sfcrmproducts.cn' })
  })

  it('getSfHost returns the mcas.ms domain verbatim', async () => {
    const res = await invoke({ message: 'getSfHost', url: 'https://example.mcas.ms/page' })
    expect(res).toBe('example.mcas.ms')
  })

  it('getSfHost maps salesforce-setup.com to my.salesforce.com when the sid cookie exists', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'acme.my.salesforce.com',
      value: 'x',
      name: 'sid'
    } as chrome.cookies.Cookie)
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.my.salesforce-setup.com/setup' })
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost falls back to the current domain when no sid cookie is found', async () => {
    chrome.cookies.get.mockResolvedValue(null)
    chrome.cookies.getAll.mockResolvedValue([])
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.my.salesforce.com/page' })
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost maps a China sfcrmproducts.cn setup domain to its my-domain', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme.my.sfcrmproducts.cn') {
        return { domain: 'acme.my.sfcrmproducts.cn', value: 'x', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.setup.sfcrmproducts.cn/page' })
    expect(res).toBe('acme.my.sfcrmproducts.cn')
  })

  it('getSfHost prefers a matching my-domain cookie sharing the org id', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme.lightning.force.com') {
        return { domain: 'acme.lightning.force.com', value: '00Dxx!SID', name: 'sid' } as chrome.cookies.Cookie
      }
      if (url === 'https://acme.my.salesforce.com') {
        return { domain: 'acme.my.salesforce.com', value: '00Dxx!OTHER', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.lightning.force.com/page' })
    expect(res).toBe('acme.my.salesforce.com')
  })

  it('getSfHost scans SF_DOMAINS via getAll to locate the session domain', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://acme.lightning.force.com/page') {
        return { domain: 'acme.lightning.force.com', value: '00Dxx!SID', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    chrome.cookies.getAll.mockImplementation(async ({ domain }: { domain: string }) => {
      if (domain === 'salesforce.com') {
        return [{ domain: 'acme.my.salesforce.com', value: '00Dxx!SID', name: 'sid' } as chrome.cookies.Cookie]
      }
      return []
    })
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.lightning.force.com/page' })
    expect(res).toBe('acme.my.salesforce.com')
  })
})
