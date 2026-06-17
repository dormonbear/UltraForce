import { describe, it, expect } from 'vitest'
import { normalizeHost, isSalesforceDomain, escapeSoql, escapeSoqlLiteral } from './domain-utils'

describe('normalizeHost', () => {
  it('should return empty string for empty input', () => {
    expect(normalizeHost('')).toBe('')
  })

  it('should strip leading dot', () => {
    expect(normalizeHost('.example.my.salesforce.com')).toBe('example.my.salesforce.com')
  })

  it('should strip protocol prefix', () => {
    expect(normalizeHost('https://example.my.salesforce.com')).toBe('example.my.salesforce.com')
    expect(normalizeHost('http://example.my.salesforce.com')).toBe('example.my.salesforce.com')
  })

  it('should convert lightning.force to my.salesforce', () => {
    expect(normalizeHost('example.lightning.force.com')).toBe('example.my.salesforce.com')
  })

  it('should convert China sandbox setup domains (sfcrmproducts)', () => {
    expect(normalizeHost('org.sandbox.setup.sfcrmproducts.cn')).toBe('org.sandbox.my.sfcrmproducts.cn')
    expect(normalizeHost('org.sandbox.lightning.sfcrmproducts.cn')).toBe('org.sandbox.my.sfcrmproducts.cn')
  })

  it('should convert China sandbox setup domains (sfcrmapps)', () => {
    expect(normalizeHost('org.sandbox.setup.sfcrmapps.cn')).toBe('org.sandbox.my.sfcrmapps.cn')
    expect(normalizeHost('org.sandbox.lightning.sfcrmapps.cn')).toBe('org.sandbox.my.sfcrmapps.cn')
  })

  it('should convert China production setup domains (sfcrmproducts)', () => {
    expect(normalizeHost('org.setup.sfcrmproducts.cn')).toBe('org.my.sfcrmproducts.cn')
    expect(normalizeHost('org.lightning.sfcrmproducts.cn')).toBe('org.my.sfcrmproducts.cn')
  })

  it('should convert China production setup domains (sfcrmapps)', () => {
    expect(normalizeHost('org.setup.sfcrmapps.cn')).toBe('org.my.sfcrmapps.cn')
    expect(normalizeHost('org.lightning.sfcrmapps.cn')).toBe('org.my.sfcrmapps.cn')
  })

  it('should handle China file/content/c domain variants', () => {
    expect(normalizeHost('org.file.sfcrmproducts.cn')).toBe('org.my.sfcrmproducts.cn')
    expect(normalizeHost('org.content.sfcrmapps.cn')).toBe('org.my.sfcrmapps.cn')
    expect(normalizeHost('org.c.sfcrmproducts.cn')).toBe('org.my.sfcrmproducts.cn')
  })

  it('should strip mcas.ms suffix (Microsoft CAS proxy)', () => {
    expect(normalizeHost('example.my.salesforce.com.mcas.ms')).toBe('example.my.salesforce.com')
  })

  it('should leave normal my.salesforce.com domains unchanged', () => {
    expect(normalizeHost('example.my.salesforce.com')).toBe('example.my.salesforce.com')
  })

  it('should handle combined transformations', () => {
    expect(normalizeHost('https://.org.lightning.force.com.mcas.ms')).toBe('org.my.salesforce.com')
  })
})

describe('isSalesforceDomain', () => {
  it('should match standard Salesforce domains', () => {
    expect(isSalesforceDomain('myorg.my.salesforce.com')).toBe(true)
    expect(isSalesforceDomain('myorg.lightning.force.com')).toBe(true)
    expect(isSalesforceDomain('myorg.salesforce-setup.com')).toBe(true)
  })

  it('should match Visualforce domains', () => {
    expect(isSalesforceDomain('myorg.visual.force.com')).toBe(true)
    expect(isSalesforceDomain('myorg--c.visualforce.com')).toBe(true)
  })

  it('should match China domains', () => {
    expect(isSalesforceDomain('org.my.sfcrmproducts.cn')).toBe(true)
    expect(isSalesforceDomain('org.my.sfcrmapps.cn')).toBe(true)
    expect(isSalesforceDomain('org.sandbox.my.sfcrmproducts.cn')).toBe(true)
  })

  it('should match login domains', () => {
    expect(isSalesforceDomain('login.salesforce.com')).toBe(true)
    expect(isSalesforceDomain('test.salesforce.com')).toBe(true)
  })

  it('should not match non-Salesforce domains', () => {
    expect(isSalesforceDomain('google.com')).toBe(false)
    expect(isSalesforceDomain('salesforce.fake.com')).toBe(false)
    expect(isSalesforceDomain('')).toBe(false)
  })
})

describe('escapeSoql', () => {
  it('should escape single quotes', () => {
    expect(escapeSoql("O'Brien")).toBe("O\\'Brien")
  })

  it('should escape backslashes before single quotes', () => {
    expect(escapeSoql("test\\'value")).toBe("test\\\\\\'value")
  })

  it('should escape LIKE wildcard percent', () => {
    expect(escapeSoql('50%')).toBe('50\\%')
  })

  it('should escape LIKE wildcard underscore', () => {
    expect(escapeSoql('a_b')).toBe('a\\_b')
  })

  it('should return unchanged string without special characters', () => {
    expect(escapeSoql('normal string')).toBe('normal string')
  })

  it('should handle empty string', () => {
    expect(escapeSoql('')).toBe('')
  })
})

describe('escapeSoqlLiteral', () => {
  it('should NOT escape underscores (exact-match query)', () => {
    expect(escapeSoqlLiteral('IC_Royalty_Center__c')).toBe('IC_Royalty_Center__c')
  })

  it('should NOT escape percent', () => {
    expect(escapeSoqlLiteral('50%')).toBe('50%')
  })

  it('should escape single quotes', () => {
    expect(escapeSoqlLiteral("O'Brien")).toBe("O\\'Brien")
  })

  it('should escape backslashes before single quotes', () => {
    expect(escapeSoqlLiteral("test\\'value")).toBe("test\\\\\\'value")
  })
})
