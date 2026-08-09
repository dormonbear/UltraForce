// Full-chain tests for the expired-session defect (fixed behavior).
//
// The defect: hashSession was sid.substring(0, 8) while a sid is
// <orgId>!<token> (background/index.ts:184), so the "Session changed" guard
// could not detect a session change within the same org; and the probe
// treated a 401 (session expired) like a 403 (no permission), persisting
// every Tooling API type as unsupported. One expired session hid the types
// for 24h.
//
// Fixed behavior asserted here:
// - 401: the probe aborts and persists NO verdict; nothing is hidden.
// - 403: the real permission verdict still persists.
// - The fingerprint (FNV-1a digest of the full sid) distinguishes two
//   sessions of the same org, so a fresh login rechecks.
// - Pre-fix state stamped with the plaintext org prefix is detected as
//   foreign and rechecked, so poisoned entries recover without a manual
//   clear or the 24h TTL.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STORAGE_KEYS } from './storage-service'

// In-memory chrome.storage.local stand-in shared by the mock and assertions.
const { fakeStore } = vi.hoisted(() => ({ fakeStore: new Map<string, unknown>() }))

vi.mock('./storage-service', async () => {
  const actual = await vi.importActual<typeof import('./storage-service')>('./storage-service')
  return {
    ...actual,
    storageGet: vi.fn(async (key: string) => fakeStore.get(key)),
    storageSet: vi.fn(async (key: string, value: unknown) => {
      fakeStore.set(key, value)
    }),
    storageRemove: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys]
      list.forEach((k) => fakeStore.delete(k))
    })
  }
})

vi.mock('./auth', () => ({
  getSession: vi.fn(),
  sfRest: vi.fn(),
  API_VERSION: '62.0'
}))

vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('./api-stats', () => ({
  trackApiRequest: vi.fn()
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((host: string) => host),
  escapeSoql: vi.fn((input: string) => input)
}))

vi.mock('./fuzzy-search', () => ({
  buildSearchIndex: vi.fn(),
  searchIndex: vi.fn().mockReturnValue([]),
  hasSearchIndex: vi.fn().mockReturnValue(false),
  clearSearchIndex: vi.fn(),
  clearAllSearchIndexes: vi.fn(),
  parseSearchQuery: vi.fn(() => ({ searchTerm: '', filterTerm: null, isExactMatch: false }))
}))

vi.mock('./metadata-cache', () => ({
  MetadataCache: {
    getInstance: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn(), clear: vi.fn(), getStats: vi.fn() })
  }
}))

vi.mock('./metadata-fetcher', () => ({
  getMetadataWithCache: vi.fn(),
  fetchMetadataFromAPI: vi.fn(),
  fetchAllPages: vi.fn(),
  ensureCMDTRecordIndex: vi.fn(),
  ensureCustomSettingRecordIndex: vi.fn(),
  ensureFieldIndex: vi.fn(),
  ensureMetadataIndex: vi.fn()
}))

vi.mock('./profile-search', () => ({
  parseProfileDotNotation: vi.fn(),
  buildProfileSubMenu: vi.fn(),
  queryProfileUsers: vi.fn().mockResolvedValue([]),
  queryProfileObjectPermissions: vi.fn().mockResolvedValue([]),
  queryProfileFieldPermissions: vi.fn().mockResolvedValue([]),
  queryProfileCustomPermissions: vi.fn().mockResolvedValue([]),
  queryProfileApexClassAccess: vi.fn().mockResolvedValue([]),
  queryProfileVFPageAccess: vi.fn().mockResolvedValue([]),
  queryProfileConnectedApps: vi.fn().mockResolvedValue([]),
  queryProfileAssignedApps: vi.fn().mockResolvedValue([]),
  filterProfileSubData: vi.fn((data: unknown) => data)
}))

// NOTE: './unsupported-types' is intentionally NOT mocked - the point of these
// tests is the real persistence + guard behavior.

import { checkMetadataPermissions } from './salesforce-api'
import { getSession } from './auth'
import { getUnsupportedTypes, needsPermissionCheck, clearUnsupportedTypesCache } from './unsupported-types'

const mockGetSession = vi.mocked(getSession)
const mockFetch = vi.fn()

// A real sid is <orgId>!<token>; the first 8 chars are the org-ID prefix.
const ORG_PREFIX = '00D5g000'
const HOST = 'myorg.my.salesforce.com'
const STALE_SID = `${ORG_PREFIX}00000XYZ!STALE_TOKEN_AAAA`
const FRESH_SID = `${ORG_PREFIX}00000XYZ!FRESH_TOKEN_BBBB`

const UNAUTHORIZED_RESPONSE = {
  ok: false,
  status: 401,
  text: async () => '[{"message":"Session expired or invalid","errorCode":"INVALID_SESSION_ID"}]'
}

const FORBIDDEN_RESPONSE = {
  ok: false,
  status: 403,
  text: async () => '[{"message":"Insufficient privileges","errorCode":"INSUFFICIENT_ACCESS"}]'
}

const OK_RESPONSE = { ok: true, text: async () => '[]' }

describe('session expiry chain', () => {
  beforeEach(async () => {
    fakeStore.clear()
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ key: STALE_SID, hostname: HOST })
    global.fetch = mockFetch
    await clearUnsupportedTypesCache()
  })

  it('a 401 probe persists no verdict: nothing is hidden, a recheck still happens', async () => {
    mockFetch.mockResolvedValue(UNAUTHORIZED_RESPONSE)

    const result = await checkMetadataPermissions(HOST)

    expect(result).toEqual([])
    // No state was written for this host at all
    expect(fakeStore.get(STORAGE_KEYS.UNSUPPORTED_TYPES)).toBeUndefined()
    expect(await getUnsupportedTypes(HOST)).toEqual([])
    // A fresh session of the same org still rechecks (no verdict to trust)
    expect(await needsPermissionCheck(HOST, FRESH_SID)).toBe(true)
  })

  it('a 403 verdict persists, and a new same-org session triggers a recheck', async () => {
    mockFetch.mockResolvedValue(FORBIDDEN_RESPONSE)

    await checkMetadataPermissions(HOST)

    // The real permission case still works: tooling types are unsupported
    const poisoned = await getUnsupportedTypes(HOST)
    expect(poisoned).toContain('ApexClass')
    expect(poisoned).toContain('Flow')

    // The stored fingerprint is a digest of the stale sid, and the fresh
    // session of the same org hashes differently: the guard rechecks
    expect(await needsPermissionCheck(HOST, FRESH_SID)).toBe(true)

    // After the user logs back in, the recheck under a valid session
    // overwrites the old verdict
    mockFetch.mockResolvedValue(OK_RESPONSE)
    await checkMetadataPermissions(HOST)
    expect(await getUnsupportedTypes(HOST)).toEqual([])
  })

  it('a legacy plaintext org-prefix fingerprint triggers a recheck and recovers', async () => {
    // Pre-fix poisoned state: org-ID prefix stored verbatim as sessionHash
    const now = Date.now()
    fakeStore.set(STORAGE_KEYS.UNSUPPORTED_TYPES, {
      [HOST]: { types: ['ApexClass', 'Flow'], checkedAt: now, sessionHash: ORG_PREFIX }
    })

    // A fresh session of the same org is not fooled by the legacy stamp
    expect(await needsPermissionCheck(HOST, FRESH_SID)).toBe(true)

    // The recheck under a valid session replaces the poisoned state
    mockGetSession.mockResolvedValue({ key: FRESH_SID, hostname: HOST })
    mockFetch.mockResolvedValue(OK_RESPONSE)
    await checkMetadataPermissions(HOST)
    expect(await getUnsupportedTypes(HOST)).toEqual([])
  })
})
