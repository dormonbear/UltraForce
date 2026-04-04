/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest'
import { chrome } from 'vitest-chrome/lib/index.esm.js'

// vitest-chrome provides typed mocks for all Chrome APIs
// but functions have NO default implementation -- configure defaults
// that existing tests depend on
Object.assign(global, { chrome })

// Restore default behaviors that existing tests expect
chrome.storage.local.get.mockResolvedValue({})
chrome.storage.local.set.mockResolvedValue(undefined)
chrome.storage.local.remove.mockResolvedValue(undefined)
chrome.cookies.get.mockResolvedValue(null)
chrome.runtime.getManifest.mockReturnValue({ version: '0.1.0' } as chrome.runtime.Manifest)
chrome.tabs.query.mockResolvedValue([])
