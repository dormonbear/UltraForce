/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest'

// Mock chrome API for tests
const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined)
    }
  },
  cookies: {
    get: vi.fn().mockResolvedValue(null)
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    },
    getManifest: vi.fn().mockReturnValue({ version: '0.1.0' })
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    sendMessage: vi.fn()
  }
}

vi.stubGlobal('chrome', chromeMock)
