import { checkForUpdate, markNotificationAsShown, RELEASE_NOTES_URL } from './version-check'
import { STORAGE_KEYS } from './storage-service'

describe('version-check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    chrome.runtime.getManifest.mockReturnValue({ version: '1.2.0' } as chrome.runtime.Manifest)
  })

  describe('RELEASE_NOTES_URL', () => {
    it('should point to the docs site', () => {
      expect(RELEASE_NOTES_URL).toContain('ultraforce.dormon.net')
    })
  })

  describe('checkForUpdate', () => {
    it('should report no update when no previous version stored', async () => {
      const result = await checkForUpdate()
      expect(result).toEqual({ hasUpdate: false, currentVersion: '1.2.0' })
    })

    it('should report no update when version is the same', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VERSION_CHECK]: { lastVersion: '1.2.0', hasShownNotification: false }
      })
      const result = await checkForUpdate()
      expect(result.hasUpdate).toBe(false)
    })

    it('should report update when version changed and notification not shown', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VERSION_CHECK]: { lastVersion: '1.1.0', hasShownNotification: false }
      })
      const result = await checkForUpdate()
      expect(result.hasUpdate).toBe(true)
      expect(result.currentVersion).toBe('1.2.0')
    })

    it('should not report update when notification already shown', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VERSION_CHECK]: { lastVersion: '1.1.0', hasShownNotification: true }
      })
      const result = await checkForUpdate()
      expect(result.hasUpdate).toBe(false)
    })

    it('should return current version from manifest', async () => {
      chrome.runtime.getManifest.mockReturnValue({ version: '2.0.0' } as chrome.runtime.Manifest)
      const result = await checkForUpdate()
      expect(result.currentVersion).toBe('2.0.0')
    })
  })

  describe('markNotificationAsShown', () => {
    it('should save current version with hasShownNotification true', async () => {
      await markNotificationAsShown()
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VERSION_CHECK]: {
          lastVersion: '1.2.0',
          hasShownNotification: true
        }
      })
    })

    it('should handle storage errors silently', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('quota'))
      await expect(markNotificationAsShown()).resolves.toBeUndefined()
    })
  })
})
