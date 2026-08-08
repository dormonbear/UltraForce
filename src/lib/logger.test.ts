import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type TestLogger = typeof import('./logger').logger

describe('logger', () => {
  let cachedLogger: TestLogger
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await import('./logger')
    cachedLogger = mod.logger
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  async function importProdLogger(): Promise<TestLogger> {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./logger')
    return mod.logger
  }

  it('logs debug messages to console.log in non-production', () => {
    cachedLogger.debug('hello', 42)
    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('logs info messages to console.log in non-production', () => {
    cachedLogger.info('started')
    expect(logSpy.mock.calls[0]?.[0]).toContain('[UltraForce]')
    expect(logSpy.mock.calls[0]?.[1]).toBe('started')
  })

  it('logs warn messages to console.warn in non-production', () => {
    cachedLogger.warn('careful')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('logs error messages to console.error with the prefix', () => {
    cachedLogger.error('boom')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[UltraForce]')
  })

  it('formats entries with a timestamp', () => {
    cachedLogger.info('x')
    const head = logSpy.mock.calls[0]?.[0] as string
    expect(head).toMatch(/^\[UltraForce\]\[\d{2}:\d{2}:\d{2}\]$/)
  })

  it('passes extra arguments through to the console', () => {
    cachedLogger.debug('detail', { a: 1 }, ['x'])
    expect(logSpy.mock.calls[0]?.[1]).toBe('detail')
    expect(logSpy.mock.calls[0]?.[2]).toEqual({ a: 1 })
    expect(logSpy.mock.calls[0]?.[3]).toEqual(['x'])
  })

  it('suppresses debug, info and warn in production', async () => {
    const prodLogger = await importProdLogger()

    prodLogger.debug('hidden')
    prodLogger.info('hidden')
    prodLogger.warn('hidden')

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('still logs errors in production', async () => {
    const prodLogger = await importProdLogger()

    prodLogger.error('critical')

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[UltraForce]')
  })
})
