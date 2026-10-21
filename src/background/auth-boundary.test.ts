import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('~lib/storage-service', () => ({
  storageSet: vi.fn().mockResolvedValue(undefined),
  storageRemove: vi.fn().mockResolvedValue(undefined),
  STORAGE_KEYS: { LEGACY_SETTINGS: 'settings' }
}))
vi.hoisted(() => {
  Object.assign(chrome.runtime, { id: 'fixture-extension' })
  Object.assign(chrome, {
    action: { onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } }
  })
})
import './index'

const host = 'acme.my.salesforce.com'
const documentUrl = `https://${host}/lightning/page/home`
const orgId = '00D000000000001'
const cookie = (domain: string, value = `${orgId}!synthetic`) => ({ domain, value, name: 'sid' })
function invoke(request: unknown, sender: Partial<chrome.runtime.MessageSender> = {}) {
  return new Promise<unknown>((resolve) => {
    ;(
      chrome.runtime.onMessage as unknown as {
        callListeners: (
          request: unknown,
          sender: Partial<chrome.runtime.MessageSender>,
          response: (value: unknown) => void
        ) => void
      }
    ).callListeners(request, { id: chrome.runtime.id, url: documentUrl, origin: `https://${host}`, ...sender }, resolve)
  })
}

describe('authentication message boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      return cookie(new URL(url).hostname) as chrome.cookies.Cookie
    })
    chrome.cookies.getAll.mockResolvedValue([])
  })

  it.each([
    'https://acme.salesforce.com.attacker.invalid/',
    'https://attacker.invalid/?next=https://acme.salesforce.com/',
    'https://attacker.invalid/https://acme.salesforce.com/',
    'https://acme.salesforce.com@attacker.invalid/',
    'https://user@acme.my.salesforce.com/',
    'https://@acme.my.salesforce.com/',
    'https:///acme.my.salesforce.com/',
    'https://acme%2emy.salesforce.com/',
    'https://acme.my.salesforce.com:8443/',
    'http://acme.my.salesforce.com/',
    'https://acme.my.salesforce.com./',
    'https://acme..my.salesforce.com/',
    'https://example.mcas.ms/',
    'not a URL'
  ])('rejects invalid document origin %s before reading cookies', async (url) => {
    expect(await invoke({ message: 'getSession', sfHost: host }, { url, origin: undefined })).toBeNull()
    expect(chrome.cookies.get).not.toHaveBeenCalled()
    expect(chrome.cookies.getAll).not.toHaveBeenCalled()
  })

  it.each([
    { id: 'another-extension' },
    { id: undefined },
    { origin: 'https://other.my.salesforce.com' },
    { origin: 'null' },
    { url: undefined }
  ])('rejects inconsistent sender identity %j', async (sender) => {
    expect(await invoke({ message: 'getSession', sfHost: host }, sender)).toBeNull()
    expect(chrome.cookies.get).not.toHaveBeenCalled()
  })

  it.each([
    'other.my.salesforce.com',
    'attacker.invalid',
    'acme.my.salesforce.com@attacker.invalid',
    'acme.my.salesforce.com/path',
    'acme.my.salesforce.com:8443',
    'https://acme.my.salesforce.com',
    '',
    null,
    42,
    {}
  ])('does not let session payload select a different host %j', async (sfHost) => {
    expect(await invoke({ message: 'getSession', sfHost })).toBeNull()
    expect(
      chrome.cookies.get.mock.calls.every(([details]) => new URL(details.url).hostname !== 'other.my.salesforce.com')
    ).toBe(true)
  })

  it.each(['https://other.my.salesforce.com/', 'https://attacker.invalid/', null, 42])(
    'rejects host resolution payload outside sender origin %j',
    async (url) => {
      expect(await invoke({ message: 'getSfHost', url })).toBeNull()
      expect(chrome.cookies.get).not.toHaveBeenCalled()
    }
  )

  it('handles malformed messages without throwing or reading cookies', async () => {
    for (const request of [null, undefined, 'getSession', 5]) {
      expect(await invoke(request)).toEqual({ success: false, error: 'Unknown message' })
    }
    expect(chrome.cookies.get).not.toHaveBeenCalled()
  })

  it('accepts default HTTPS port and ignores the top-level tab URL for a valid frame', async () => {
    expect(
      await invoke(
        { message: 'getSession', sfHost: host },
        {
          url: `https://${host}:443/frame`,
          tab: { url: 'https://unrelated.invalid/' } as chrome.tabs.Tab
        }
      )
    ).toEqual({ key: `${orgId}!synthetic`, hostname: host })
    expect(chrome.cookies.getAll).not.toHaveBeenCalled()
  })

  it('supports browsers with a document URL but no origin field', async () => {
    expect(await invoke({ message: 'getSession', sfHost: host }, { origin: undefined })).toEqual({
      key: `${orgId}!synthetic`,
      hostname: host
    })
  })

  it.each([
    ['acme.lightning.force.com', 'acme.my.salesforce.com'],
    ['acme--uat.sandbox.lightning.force.com', 'acme--uat.sandbox.my.salesforce.com'],
    ['acme.my.salesforce-setup.com', 'acme.my.salesforce.com'],
    ['acme--uat.sandbox.my.salesforce-setup.com', 'acme--uat.sandbox.my.salesforce.com'],
    ['acme--c.vf.force.com', 'acme.my.salesforce.com'],
    ['acme--pkg.visualforce.com', 'acme.my.salesforce.com'],
    ['acme--uat--c.sandbox.vf.force.com', 'acme--uat.sandbox.my.salesforce.com'],
    ['acme.setup.sfcrmproducts.cn', 'acme.my.sfcrmproducts.cn'],
    ['acme.sandbox.setup.sfcrmproducts.cn', 'acme.sandbox.my.sfcrmproducts.cn'],
    ['acme.lightning.sfcrmapps.cn', 'acme.my.sfcrmproducts.cn'],
    ['acme.sandbox.lightning.sfcrmapps.cn', 'acme.sandbox.my.sfcrmproducts.cn']
  ])('resolves %s to sender-related %s', async (source, target) => {
    const sender = { url: `https://${source}/page`, origin: `https://${source}` }
    expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(target)
    expect(await invoke({ message: 'getSession', sfHost: target }, sender)).toEqual({
      key: `${orgId}!synthetic`,
      hostname: target
    })
  })

  it('does not guess a China org from a US first label when the source has no cookie', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) =>
      url.includes('sfcrmproducts.cn') ? (cookie('acme.my.sfcrmproducts.cn') as chrome.cookies.Cookie) : null
    )
    expect(await invoke({ message: 'getSfHost', url: documentUrl })).toBe(host)
    expect(await invoke({ message: 'getSession', sfHost: 'acme.my.sfcrmproducts.cn' })).toBeNull()
    expect(chrome.cookies.getAll).not.toHaveBeenCalled()
  })

  it.each(['!empty-prefix', 'bad!prefix', '00D000000000002!other'])(
    'does not use a foreign or malformed org prefix %s',
    async (other) => {
      const source = 'acme--pkg.na99.visual.force.com'
      chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) =>
        url === `https://${source}` ? (cookie(source) as chrome.cookies.Cookie) : null
      )
      chrome.cookies.getAll.mockResolvedValue([cookie('other.my.salesforce.com', other)] as chrome.cookies.Cookie[])
      const sender = { url: `https://${source}/page`, origin: `https://${source}` }
      expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(source)
      expect(await invoke({ message: 'getSession', sfHost: 'other.my.salesforce.com' }, sender)).toBeNull()
      expect(chrome.cookies.getAll).toHaveBeenCalled()
    }
  )

  it.each(['!empty', 'invalid!prefix', '00D000000000001', '00D000000000001!'])(
    'does not scan any cookie domains using malformed source session %s',
    async (value) => {
      const source = 'acme--pkg.na99.visual.force.com'
      chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) =>
        url === `https://${source}` ? (cookie(source, value) as chrome.cookies.Cookie) : null
      )
      chrome.cookies.getAll.mockResolvedValue([cookie('other.my.salesforce.com', value)] as chrome.cookies.Cookie[])
      const sender = { url: `https://${source}/page`, origin: `https://${source}` }
      expect(await invoke({ message: 'getSession', sfHost: 'other.my.salesforce.com' }, sender)).toBeNull()
      expect(chrome.cookies.getAll).not.toHaveBeenCalled()
    }
  )

  it('does not authorize a lookalike cookie domain even if its org prefix matches', async () => {
    const source = 'acme--pkg.na99.visual.force.com'
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) =>
      url === `https://${source}` ? (cookie(source) as chrome.cookies.Cookie) : null
    )
    chrome.cookies.getAll.mockResolvedValue([
      cookie('acme.my.salesforce.com.attacker.invalid')
    ] as chrome.cookies.Cookie[])
    const sender = { url: `https://${source}/page`, origin: `https://${source}` }
    expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(source)
    expect(chrome.cookies.get.mock.calls).not.toContainEqual([
      expect.objectContaining({ url: 'https://acme.my.salesforce.com.attacker.invalid' })
    ])
  })

  it('permits a legacy instance fallback only when its complete session matches', async () => {
    const source = 'acme--pkg.na99.visual.force.com'
    const target = 'na99.salesforce.com'
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) =>
      [source, target].includes(new URL(url).hostname) ? (cookie(new URL(url).hostname) as chrome.cookies.Cookie) : null
    )
    chrome.cookies.getAll.mockResolvedValue([cookie(target)] as chrome.cookies.Cookie[])
    const sender = { url: `https://${source}/apex/page`, origin: `https://${source}` }
    expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(target)
    expect(await invoke({ message: 'getSession', sfHost: target }, sender)).toEqual({
      key: `${orgId}!synthetic`,
      hostname: target
    })
  })

  it('does not replace a source session with a mapped cookie for another organization', async () => {
    const source = 'acme.lightning.force.com'
    chrome.cookies.get.mockImplementation(
      async ({ url }: { url: string }) =>
        cookie(
          new URL(url).hostname,
          url.includes('.my.') ? '00D000000000002!other' : `${orgId}!synthetic`
        ) as chrome.cookies.Cookie
    )
    const sender = { url: `https://${source}/page`, origin: `https://${source}` }
    expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(source)
    expect(await invoke({ message: 'getSession', sfHost: host }, sender)).toBeNull()
  })

  it('does not authorize a discovered session from an org prefix alone', async () => {
    const source = 'acme--pkg.na99.visual.force.com'
    const target = 'other.my.salesforce.com'
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url === `https://${source}`)
        return cookie(source, `${orgId}!unrelated-source-session`) as chrome.cookies.Cookie
      if (url === `https://${target}`)
        return cookie(target, `${orgId}!different-target-session`) as chrome.cookies.Cookie
      return null
    })
    chrome.cookies.getAll.mockResolvedValue([
      cookie(target, `${orgId}!different-target-session`)
    ] as chrome.cookies.Cookie[])
    const sender = { url: `https://${source}/page`, origin: `https://${source}` }
    expect(await invoke({ message: 'getSfHost', url: sender.url }, sender)).toBe(source)
    expect(await invoke({ message: 'getSession', sfHost: target }, sender)).toBeNull()
  })
})
