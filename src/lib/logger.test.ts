import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(['production', 'development', 'test'])('logger privacy in %s', (environment) => {
  it('never serializes or logs caller content at any level', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', environment)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logger } = await import('./logger')
    const toJSON = vi.fn(() => 'PRIVATE-SERIALIZED')
    const payload = {
      sid: 'PRIVATE-SESSION',
      query: 'SELECT Id FROM PRIVATE-QUERY',
      org: 'private-org.my.salesforce.com',
      url: 'https://private-page.example/record',
      body: 'PRIVATE-RESPONSE',
      toJSON
    }
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      logger[level]('PRIVATE-LABEL', payload, new Error('PRIVATE-ERROR'))
    }
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error.mock.calls).toEqual([['[UltraForce] An operation failed.']])
    expect(toJSON).not.toHaveBeenCalled()
  })
})
