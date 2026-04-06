import { describe, it, expect } from 'vitest'
import { isSalesforceId, extractSalesforceId, extractAllSalesforceIds, getKeyPrefix } from './id-utils'

describe('isSalesforceId', () => {
  it('accepts valid 15-char ID', () => {
    expect(isSalesforceId('001000000000001')).toBe(true)
  })

  it('accepts valid 18-char ID', () => {
    expect(isSalesforceId('001000000000001AAA')).toBe(true)
  })

  it('rejects 14-char string (too short)', () => {
    expect(isSalesforceId('00100000000001')).toBe(false)
  })

  it('rejects 19-char string (too long)', () => {
    expect(isSalesforceId('001000000000001AAAB')).toBe(false)
  })

  it('rejects string with special characters', () => {
    expect(isSalesforceId('001!@#$%^&*()001')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isSalesforceId('')).toBe(false)
  })

  it('trims whitespace before validating', () => {
    expect(isSalesforceId('  001000000000001  ')).toBe(true)
  })

  it('rejects 16-char string (between valid lengths)', () => {
    expect(isSalesforceId('0010000000000012')).toBe(false)
  })
})

describe('extractSalesforceId', () => {
  const VALID_18 = '001000000000001AAA'
  const VALID_15 = '001000000000001'

  it('extracts plain 18-char ID', () => {
    expect(extractSalesforceId(VALID_18)).toBe(VALID_18)
  })

  it('extracts plain 15-char ID', () => {
    expect(extractSalesforceId(VALID_15)).toBe(VALID_15)
  })

  it('extracts ID from classic Salesforce URL', () => {
    expect(
      extractSalesforceId(`https://myorg.salesforce.com/${VALID_18}`)
    ).toBe(VALID_18)
  })

  it('extracts ID from Lightning record URL', () => {
    expect(
      extractSalesforceId(
        `https://myorg.lightning.force.com/lightning/r/Account/${VALID_18}/view`
      )
    ).toBe(VALID_18)
  })

  it('extracts ID from mixed text', () => {
    expect(
      extractSalesforceId(`check record ${VALID_18} please`)
    ).toBe(VALID_18)
  })

  it('returns null for empty string', () => {
    expect(extractSalesforceId('')).toBeNull()
  })

  it('returns null for text with no ID', () => {
    expect(extractSalesforceId('hello world')).toBeNull()
  })

  it('returns null for URL without ID', () => {
    expect(
      extractSalesforceId('https://myorg.salesforce.com/setup/home')
    ).toBeNull()
  })

  it('extracts ID with whitespace padding', () => {
    expect(extractSalesforceId(`  ${VALID_18}  `)).toBe(VALID_18)
  })

  it('extracts ID from URL with query parameters', () => {
    expect(
      extractSalesforceId(
        `https://myorg.salesforce.com/${VALID_18}?inline=1`
      )
    ).toBe(VALID_18)
  })

  it('prefers 18-char ID over 15-char in mixed content', () => {
    const result = extractSalesforceId(`id is ${VALID_18} here`)
    expect(result).toBe(VALID_18)
    expect(result).toHaveLength(18)
  })
})

describe('extractAllSalesforceIds', () => {
  const ID_A = '001000000000001AAA'
  const ID_B = '003000000000002BBB'
  const ID_C = '005000000000003CCC'

  it('returns single ID from plain input', () => {
    expect(extractAllSalesforceIds(ID_A)).toEqual([ID_A])
  })

  it('returns multiple IDs from text with several IDs', () => {
    const result = extractAllSalesforceIds(`check ${ID_A} and ${ID_B} and ${ID_C}`)
    expect(result).toEqual([ID_A, ID_B, ID_C])
  })

  it('deduplicates same ID appearing twice', () => {
    const result = extractAllSalesforceIds(`${ID_A} then ${ID_A}`)
    expect(result).toEqual([ID_A])
  })

  it('returns empty array for empty string', () => {
    expect(extractAllSalesforceIds('')).toEqual([])
  })

  it('returns empty array for text with no IDs', () => {
    expect(extractAllSalesforceIds('hello world')).toEqual([])
  })

  it('handles mixed URLs and plain IDs', () => {
    const input = `https://org.salesforce.com/${ID_A} and also ${ID_B}`
    const result = extractAllSalesforceIds(input)
    expect(result).toContain(ID_A)
    expect(result).toContain(ID_B)
  })
})

describe('getKeyPrefix', () => {
  it('returns first 3 characters of an ID', () => {
    expect(getKeyPrefix('001000000000001AAA')).toBe('001')
  })

  it('returns first 3 characters of a short string', () => {
    expect(getKeyPrefix('abc')).toBe('abc')
  })

  it('works with 15-char IDs', () => {
    expect(getKeyPrefix('005000000000001')).toBe('005')
  })
})
