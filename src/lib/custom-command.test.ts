import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./auth', () => ({ getSession: vi.fn(), API_VERSION: '62.0' }))
vi.mock('./metadata-fetcher', () => ({ fetchAllPages: vi.fn() }))
vi.mock('./fuzzy-search', () => ({
  parseSearchQuery: vi.fn((q: string) => ({ searchTerm: q, filterTerm: null, isExactMatch: false }))
}))
vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))
vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { executeCustomCommand } from './custom-command'
import { getSession } from './auth'
import { fetchAllPages } from './metadata-fetcher'
import { parseSearchQuery } from './fuzzy-search'

const mockGetSession = vi.mocked(getSession)
const mockFetchAllPages = vi.mocked(fetchAllPages)
const mockParse = vi.mocked(parseSearchQuery)
const HOST = 'myorg.my.salesforce.com'
const baseOpts = {
  soqlTemplate: "SELECT Id, Name FROM Account WHERE Name LIKE '%{query}%'",
  searchQuery: 'acme',
  useToolingApi: false,
  nameField: 'Name'
}

describe('executeCustomCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ key: 'k', hostname: HOST })
    mockParse.mockReturnValue({ searchTerm: 'acme', filterTerm: null, isExactMatch: false })
  })

  it('returns [] when sfHost is missing', async () => {
    const result = await executeCustomCommand(baseOpts, '')
    expect(result).toEqual([])
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('returns [] when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result).toEqual([])
  })

  it('maps records to CustomQuery SearchResult using nameField', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '001x', Name: 'Acme Inc', Industry: 'Tech' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '001x', name: 'Acme Inc', type: 'CustomQuery' })
    expect(result[0].description).toContain('Industry: Tech')
  })

  it('falls back to DurableId when Id absent, "Unknown" when nameField empty', async () => {
    mockFetchAllPages.mockResolvedValue([{ DurableId: 'dur1' }])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result[0].id).toBe('dur1')
    expect(result[0].name).toBe('Unknown')
  })

  it('uses descriptionFields (dot-notation) when provided', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '001x', Name: 'Acme', Owner: { Name: 'Dormon' }, Phone: '123' }
    ])
    const result = await executeCustomCommand(
      { ...baseOpts, descriptionFields: ['Owner.Name', 'Phone'] },
      HOST
    )
    expect(result[0].description).toBe('Dormon | 123')
  })

  it('filters to exact name match when isExactMatch is true', async () => {
    mockParse.mockReturnValue({ searchTerm: 'acme', filterTerm: null, isExactMatch: true })
    mockFetchAllPages.mockResolvedValue([
      { Id: '1', Name: 'Acme' },
      { Id: '2', Name: 'Acme Corp' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result.map((r) => r.name)).toEqual(['Acme'])
  })

  it('applies a secondary filterTerm against name and description', async () => {
    mockParse.mockReturnValue({ searchTerm: 'a', filterTerm: 'tech', isExactMatch: false })
    mockFetchAllPages.mockResolvedValue([
      { Id: '1', Name: 'Acme', Industry: 'Tech' },
      { Id: '2', Name: 'Globex', Industry: 'Finance' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result.map((r) => r.name)).toEqual(['Acme'])
  })

  it('throws a formatted SOQL error when the API rejects with JSON error', async () => {
    mockFetchAllPages.mockRejectedValue(
      new Error('API 400: [{"message":"unexpected token: WHERE"}]')
    )
    await expect(executeCustomCommand(baseOpts, HOST)).rejects.toThrow(/SOQL Error: unexpected token: WHERE/)
  })

  it('throws a generic formatted error when message is not JSON', async () => {
    mockFetchAllPages.mockRejectedValue(new Error('network down'))
    await expect(executeCustomCommand(baseOpts, HOST)).rejects.toThrow(/network down[\s\S]*check your custom command/i)
  })
})
