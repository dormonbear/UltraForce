import { trackApiRequest } from './api-stats'
import { normalizeHost } from './domain-utils'
import { logger } from './logger'
import { API_VERSION, getSfHost, getSession, sfRest } from './auth'

vi.mock('./api-stats', () => ({
  trackApiRequest: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((host: string) => host)
}))

vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const mockFetch = vi.fn()

describe('auth', () => {
  const trackApiRequestMock = vi.mocked(trackApiRequest)
  const normalizeHostMock = vi.mocked(normalizeHost)
  const loggerErrorMock = vi.mocked(logger.error)

  beforeEach(() => {
    vi.clearAllMocks()
    trackApiRequestMock.mockResolvedValue(undefined)
    normalizeHostMock.mockImplementation((h) => h)
    mockFetch.mockReset()
    globalThis.fetch = mockFetch
  })

  it('API_VERSION is exported correctly', () => {
    expect(API_VERSION).toBe('62.0')
  })

  describe('getSfHost', () => {
    it('sends message and returns host', async () => {
      chrome.runtime.sendMessage.mockResolvedValue('my-domain.my.salesforce.com')

      const host = await getSfHost('https://example.com/lightning')

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        message: 'getSfHost',
        url: 'https://example.com/lightning'
      })
      expect(host).toBe('my-domain.my.salesforce.com')
    })

    it('returns null on error', async () => {
      const err = new Error('boom')
      chrome.runtime.sendMessage.mockRejectedValue(err)

      const host = await getSfHost('https://x')

      expect(host).toBeNull()
      expect(loggerErrorMock).toHaveBeenCalledWith('Failed to get SF host:', err)
    })

    it('returns null when response is empty', async () => {
      chrome.runtime.sendMessage.mockResolvedValue('')

      const host = await getSfHost('https://x')

      expect(host).toBeNull()
    })
  })

  describe('getSession', () => {
    it('sends message and returns session', async () => {
      const session = { key: 'sid', hostname: 'org.my.salesforce.com' }
      chrome.runtime.sendMessage.mockResolvedValue(session)

      const result = await getSession('org.my.salesforce.com')

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        message: 'getSession',
        sfHost: 'org.my.salesforce.com'
      })
      expect(result).toEqual(session)
    })

    it('returns null on error', async () => {
      const err = new Error('no session')
      chrome.runtime.sendMessage.mockRejectedValue(err)

      const result = await getSession('h')

      expect(result).toBeNull()
      expect(loggerErrorMock).toHaveBeenCalledWith('Failed to get session:', err)
    })
  })

  describe('sfRest', () => {
    const session = { key: 'token-abc', hostname: 'ORG.example.com' }

    beforeEach(() => {
      chrome.runtime.sendMessage.mockResolvedValue(session)
    })

    it('throws when no session', async () => {
      chrome.runtime.sendMessage.mockResolvedValue(null)

      await expect(sfRest('host', '/services/data/v62.0/sobjects')).rejects.toThrow(
        'No valid session found. Please log in to Salesforce.'
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('makes GET request with Bearer auth', async () => {
      const json = vi.fn().mockResolvedValue({ ok: true })
      mockFetch.mockResolvedValue({
        ok: true,
        json
      } as unknown as Response)

      const data = await sfRest('ignored-host', '/path', { api: 'normal' })

      expect(normalizeHostMock).toHaveBeenCalledWith('ORG.example.com')
      expect(mockFetch).toHaveBeenCalledWith('https://ORG.example.com/path', {
        method: 'GET',
        headers: {
          Accept: 'application/json; charset=UTF-8',
          Authorization: 'Bearer token-abc'
        },
        body: undefined
      })
      expect(trackApiRequestMock).toHaveBeenCalledTimes(1)
      expect(data).toEqual({ ok: true })
    })

    it('makes request with X-SFDC-Session for bulk API', async () => {
      const json = vi.fn().mockResolvedValue({})
      mockFetch.mockResolvedValue({
        ok: true,
        json
      } as unknown as Response)

      await sfRest('h', '/bulk', { api: 'bulk' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://ORG.example.com/bulk',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-SFDC-Session': 'token-abc'
          })
        })
      )
      const callHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
      expect(callHeaders.Authorization).toBeUndefined()
    })

    it('sends body with Content-Type header', async () => {
      const json = vi.fn().mockResolvedValue({})
      mockFetch.mockResolvedValue({
        ok: true,
        json
      } as unknown as Response)

      await sfRest('h', '/create', { method: 'POST', body: { Name: 'Test' } })

      expect(mockFetch).toHaveBeenCalledWith('https://ORG.example.com/create', {
        method: 'POST',
        headers: {
          Accept: 'application/json; charset=UTF-8',
          Authorization: 'Bearer token-abc',
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify({ Name: 'Test' })
      })
    })

    it('throws on 401 with session expired message', async () => {
      const text = vi.fn().mockResolvedValue('Unauthorized')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text
      } as unknown as Response)

      await expect(sfRest('h', '/x')).rejects.toThrow(
        'Session expired. Please refresh the page and try again.'
      )
      expect(trackApiRequestMock).toHaveBeenCalledTimes(1)
    })

    it('throws on other error status', async () => {
      const text = vi.fn().mockResolvedValue('bad request')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text
      } as unknown as Response)

      await expect(sfRest('h', '/x')).rejects.toThrow('API Error 400: bad request')
      expect(trackApiRequestMock).toHaveBeenCalledTimes(1)
    })

    it('tracks API request on success and error', async () => {
      const json = vi.fn().mockResolvedValue({})
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json
      } as unknown as Response)

      await sfRest('h', '/ok')

      expect(trackApiRequestMock).toHaveBeenCalledTimes(1)

      const text = vi.fn().mockResolvedValue('err')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text
      } as unknown as Response)

      await expect(sfRest('h', '/fail')).rejects.toThrow()

      expect(trackApiRequestMock).toHaveBeenCalledTimes(2)
    })
  })
})
