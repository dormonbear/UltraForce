import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveObjectType, fetchRecordPreview, clearPreviewCache } from './record-preview'

// Mock sfRest
vi.mock('~lib/auth', () => ({
  sfRest: vi.fn(),
  API_VERSION: '62.0'
}))

vi.mock('~lib/logger', () => ({
  logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

import { sfRest } from '~lib/auth'
const mockSfRest = vi.mocked(sfRest)

const MOCK_GLOBAL_DESCRIBE = {
  sobjects: [
    { name: 'Account', keyPrefix: '001' },
    { name: 'Contact', keyPrefix: '003' },
    { name: 'Opportunity', keyPrefix: '006' },
    { name: 'User', keyPrefix: '005' },
    { name: 'Case', keyPrefix: '500' }
  ]
}

describe('resolveObjectType', () => {
  beforeEach(() => {
    clearPreviewCache()
    mockSfRest.mockReset()
  })

  it('resolves object type from global describe', async () => {
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)

    const result = await resolveObjectType('test.salesforce.com', '001')
    expect(result).toBe('Account')
    expect(mockSfRest).toHaveBeenCalledOnce()
  })

  it('returns null for unknown prefix', async () => {
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)

    const result = await resolveObjectType('test.salesforce.com', 'zzz')
    expect(result).toBeNull()
  })

  it('uses cache on second call (sfRest called only once)', async () => {
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)

    await resolveObjectType('test.salesforce.com', '001')
    const result = await resolveObjectType('test.salesforce.com', '003')

    expect(result).toBe('Contact')
    expect(mockSfRest).toHaveBeenCalledOnce()
  })

  it('returns null on API error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network failure'))

    const result = await resolveObjectType('test.salesforce.com', '001')
    expect(result).toBeNull()
  })

  it('rethrows AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockSfRest.mockRejectedValueOnce(abortError)

    await expect(resolveObjectType('test.salesforce.com', '001')).rejects.toThrow('The operation was aborted')
  })
})

describe('fetchRecordPreview', () => {
  beforeEach(() => {
    clearPreviewCache()
    mockSfRest.mockReset()
  })

  it('returns preview with name for valid record', async () => {
    mockSfRest
      .mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE) // global describe
      .mockResolvedValueOnce({ Id: '001000000000001AAA', Name: 'Acme Corp' }) // record fetch

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result).toMatchObject({
      id: '001000000000001AAA',
      objectType: 'Account',
      name: 'Acme Corp'
    })
    expect(result?.fetchedAt).toBeGreaterThan(0)
  })

  it('returns "Record not found" on 404', async () => {
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
    const error = Object.assign(new Error('API Error 404'), { status: 404 })
    mockSfRest.mockRejectedValueOnce(error)

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result).toMatchObject({
      objectType: 'Unknown',
      name: 'Record not found'
    })
  })

  it('returns "No access" on 403', async () => {
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
    const error = Object.assign(new Error('API Error 403'), { status: 403 })
    mockSfRest.mockRejectedValueOnce(error)

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result).toMatchObject({
      objectType: 'Unknown',
      name: 'No access'
    })
  })

  it('returns null on AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockSfRest.mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
    mockSfRest.mockRejectedValueOnce(abortError)

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result).toBeNull()
  })

  it('returns cached result within TTL', async () => {
    mockSfRest
      .mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
      .mockResolvedValueOnce({ Id: '001000000000001AAA', Name: 'Acme Corp' })

    await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    mockSfRest.mockClear()

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result?.name).toBe('Acme Corp')
    expect(mockSfRest).not.toHaveBeenCalled()
  })

  it('falls back to Subject field when Name is missing', async () => {
    mockSfRest
      .mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
      .mockResolvedValueOnce({ Id: '500000000000001AAA', Subject: 'Support Request' })

    const result = await fetchRecordPreview('test.salesforce.com', '500000000000001AAA')
    expect(result?.name).toBe('Support Request')
  })

  it('returns "Unknown object type" when prefix not found', async () => {
    mockSfRest.mockResolvedValueOnce({ sobjects: [] }) // empty global describe

    const result = await fetchRecordPreview('test.salesforce.com', 'zzz000000000001AAA')
    expect(result).toMatchObject({
      objectType: 'Unknown',
      name: 'Unknown object type'
    })
  })
})

describe('clearPreviewCache', () => {
  beforeEach(() => {
    clearPreviewCache()
    mockSfRest.mockReset()
  })

  it('clears both caches so fresh API calls are made', async () => {
    mockSfRest
      .mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
      .mockResolvedValueOnce({ Id: '001000000000001AAA', Name: 'Acme Corp' })

    await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(mockSfRest).toHaveBeenCalledTimes(2)

    clearPreviewCache()
    mockSfRest.mockReset()

    mockSfRest
      .mockResolvedValueOnce(MOCK_GLOBAL_DESCRIBE)
      .mockResolvedValueOnce({ Id: '001000000000001AAA', Name: 'Updated Name' })

    const result = await fetchRecordPreview('test.salesforce.com', '001000000000001AAA')
    expect(result?.name).toBe('Updated Name')
    expect(mockSfRest).toHaveBeenCalledTimes(2) // fresh calls after cache clear
  })
})
