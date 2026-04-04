import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SearchResult } from '~types'

// Mock dependencies before imports
vi.mock('./auth', () => ({
  sfRest: vi.fn(),
  getSession: vi.fn(),
  API_VERSION: '62.0'
}))

vi.mock('./metadata-cache', () => ({
  MetadataCache: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn()
    }))
  }
}))

vi.mock('./fuzzy-search', () => ({
  buildSearchIndex: vi.fn(),
  searchIndex: vi.fn(),
  hasSearchIndex: vi.fn()
}))

vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('./api-stats', () => ({
  trackApiRequest: vi.fn()
}))

vi.mock('./unsupported-types', () => ({
  markTypeUnsupported: vi.fn()
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))

import { fetchAllPages, fetchMetadataFromAPI, fetchFieldsForObject, getMetadataWithCache } from './metadata-fetcher'
import { sfRest } from './auth'
import { MetadataCache } from './metadata-cache'
import { buildSearchIndex, hasSearchIndex } from './fuzzy-search'

const mockSfRest = vi.mocked(sfRest)

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns records from a single page', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [{ Id: '001', Name: 'Test' }],
      done: true,
      totalSize: 1
    })

    const results = await fetchAllPages('test.salesforce.com', '/services/data/v62.0/query?q=SELECT+Id+FROM+Account')
    expect(results).toHaveLength(1)
    expect(results[0].Id).toBe('001')
  })

  it('paginates when response has nextRecordsUrl', async () => {
    mockSfRest
      .mockResolvedValueOnce({
        records: [{ Id: '001' }],
        done: false,
        totalSize: 2,
        nextRecordsUrl: '/services/data/v62.0/query/01g-next'
      })
      .mockResolvedValueOnce({
        records: [{ Id: '002' }],
        done: true,
        totalSize: 2
      })

    const results = await fetchAllPages('test.salesforce.com', '/services/data/v62.0/query?q=SELECT+Id+FROM+Account')
    expect(results).toHaveLength(2)
    expect(results[0].Id).toBe('001')
    expect(results[1].Id).toBe('002')
    expect(mockSfRest).toHaveBeenCalledTimes(2)
  })

  it('returns all records concatenated across pages', async () => {
    mockSfRest
      .mockResolvedValueOnce({
        records: [{ Id: '001' }, { Id: '002' }],
        done: false,
        totalSize: 4,
        nextRecordsUrl: '/services/data/v62.0/query/next1'
      })
      .mockResolvedValueOnce({
        records: [{ Id: '003' }, { Id: '004' }],
        done: true,
        totalSize: 4
      })

    const results = await fetchAllPages('test.salesforce.com', '/services/data/v62.0/query?q=test')
    expect(results).toHaveLength(4)
    expect(results.map((r: any) => r.Id)).toEqual(['001', '002', '003', '004'])
  })

  it('returns empty array when first page has no records', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [],
      done: true,
      totalSize: 0
    })

    const results = await fetchAllPages('test.salesforce.com', '/services/data/v62.0/query?q=test')
    expect(results).toHaveLength(0)
  })

  it('handles API errors gracefully by throwing', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Session expired'))

    await expect(
      fetchAllPages('test.salesforce.com', '/services/data/v62.0/query?q=test')
    ).rejects.toThrow('Session expired')
  })

  it('respects maxRecords option', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [{ Id: '001' }, { Id: '002' }, { Id: '003' }],
      done: false,
      totalSize: 10,
      nextRecordsUrl: '/next'
    })

    const results = await fetchAllPages('test.salesforce.com', '/path', { maxRecords: 2 })
    expect(results).toHaveLength(2)
    // Should not fetch next page since maxRecords reached
    expect(mockSfRest).toHaveBeenCalledTimes(1)
  })
})

describe('fetchMetadataFromAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls sfRest with correct SOQL query path for known type', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [{ Id: '001', Name: 'TestClass', NamespacePrefix: null, LastModifiedDate: '2024-01-01', LastModifiedBy: { Name: 'Admin' } }],
      done: true,
      totalSize: 1
    })

    const results = await fetchMetadataFromAPI('ApexClass', 'test.salesforce.com')
    expect(results).toHaveLength(1)
    expect(mockSfRest).toHaveBeenCalledWith(
      'test.salesforce.com',
      expect.stringContaining('/services/data/v62.0/tooling/query?q=')
    )
  })

  it('throws for unknown metadata type', async () => {
    await expect(
      fetchMetadataFromAPI('UnknownType', 'test.salesforce.com')
    ).rejects.toThrow('Unknown metadata type: UnknownType')
  })

  it('uses REST API for CustomObject type', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [],
      done: true,
      totalSize: 0
    })

    await fetchMetadataFromAPI('CustomObject', 'test.salesforce.com')
    expect(mockSfRest).toHaveBeenCalledWith(
      'test.salesforce.com',
      expect.stringContaining('/services/data/v62.0/query?q=')
    )
  })
})

describe('fetchFieldsForObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns field definitions for given object', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [
        {
          Id: 'f1',
          DurableId: 'Account.Name',
          QualifiedApiName: 'Name',
          Label: 'Account Name',
          DataType: 'Text',
          EntityDefinition: { QualifiedApiName: 'Account' }
        }
      ],
      done: true,
      totalSize: 1
    })

    const results = await fetchFieldsForObject('Account', 'test.salesforce.com')
    expect(results).toHaveLength(1)
    expect(results[0].MasterLabel).toBe('Account Name')
    expect(results[0].ObjectApiName).toBe('Account')
  })

  it('returns empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('API Error'))

    const results = await fetchFieldsForObject('BadObject', 'test.salesforce.com')
    expect(results).toHaveLength(0)
  })
})

describe('getMetadataWithCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cached data when fresh', async () => {
    const mockCache = {
      get: vi.fn().mockResolvedValue([{ Id: '001', Name: 'Cached' }]),
      set: vi.fn()
    }
    vi.mocked(MetadataCache.getInstance).mockReturnValue(mockCache as any)

    const result = await getMetadataWithCache('ApexClass', 'test.salesforce.com')
    expect(result).toEqual({ data: [{ Id: '001', Name: 'Cached' }], fromCache: true })
    expect(mockSfRest).not.toHaveBeenCalled()
  })

  it('fetches fresh when cache miss', async () => {
    const mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn()
    }
    vi.mocked(MetadataCache.getInstance).mockReturnValue(mockCache as any)

    mockSfRest.mockResolvedValueOnce({
      records: [{ Id: '002', Name: 'Fresh' }],
      done: true,
      totalSize: 1
    })

    const result = await getMetadataWithCache('ApexClass', 'test.salesforce.com')
    expect(result.fromCache).toBe(false)
    expect(result.data).toHaveLength(1)
    expect(mockCache.set).toHaveBeenCalled()
  })

  it('skips cache for realtime types (CustomLabel)', async () => {
    const mockCache = {
      get: vi.fn().mockResolvedValue([{ Id: '001' }]),
      set: vi.fn()
    }
    vi.mocked(MetadataCache.getInstance).mockReturnValue(mockCache as any)

    mockSfRest.mockResolvedValueOnce({
      records: [{ Id: '002', Name: 'Fresh' }],
      done: true,
      totalSize: 1
    })

    const result = await getMetadataWithCache('CustomLabel', 'test.salesforce.com')
    // Should skip cache and fetch fresh
    expect(result.fromCache).toBe(false)
    expect(mockCache.get).not.toHaveBeenCalled()
  })
})
