// Full-chain proof for the expired-session defect:
//
// Half 1: hashSession = sid.substring(0, 8), and a sid is <orgId>!<token>
//         (see src/background/index.ts:184, which splits on '!' to get the
//         org ID). The first 8 characters are the org-ID prefix - identical
//         for every session of the same org - so the "Session changed"
//         guard at unsupported-types.ts:58 cannot detect a session change.
// Half 2: salesforce-api.ts:117 treats a 401 exactly like a 403 and the
//         probe persists "no ViewSetup permission" as the verdict, stamping
//         all Tooling API types unsupported.
//
// Together: one expired session poisons the org's unsupported-types state;
// the next session of the same org cannot trigger a recheck; the types
// stay hidden from search until the 24h CHECK_EXPIRY_MS passes.

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

// NOTE: './unsupported-types' is intentionally NOT mocked - the point of this
// test is the real persistence + guard behavior.

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

describe('session expiry chain (defect proof)', () => {
  beforeEach(async () => {
    fakeStore.clear()
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ key: STALE_SID, hostname: HOST })
    global.fetch = mockFetch
    await clearUnsupportedTypesCache()
  })

  it('full chain: a 401 probe persists tooling types unsupported and a same-org session cannot recheck', async () => {
    // The org's session expired server-side, but the sid cookie is still present.
    mockFetch.mockResolvedValue(UNAUTHORIZED_RESPONSE)

    await checkMetadataPermissions(HOST)

    // Half 2: the probe stamps every Tooling API type as unsupported...
    const poisoned = await getUnsupportedTypes(HOST)
    expect(poisoned).toContain('ApexClass')
    expect(poisoned).toContain('Flow')
    // ...with the org-ID prefix as the session fingerprint
    const stored = fakeStore.get(STORAGE_KEYS.UNSUPPORTED_TYPES) as Record<
      string,
      { types: string[]; checkedAt: number; sessionHash?: string }
    >
    expect(stored[HOST].sessionHash).toBe(ORG_PREFIX)

    // Half 1: the user refreshes and gets a NEW session of the SAME org
    // (fresh token, identical first 8 chars). The guard is blind to it.
    const needs = await needsPermissionCheck(HOST, FRESH_SID)
    expect(needs).toBe(false)

    // The types stay hidden from search until the 24h TTL expires.
    expect(await getUnsupportedTypes(HOST)).toContain('ApexClass')
  })
})
