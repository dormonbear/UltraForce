import { STORAGE_KEYS, storageGet, storageSet, type VersionCheckState } from './storage-service'

export const RELEASE_NOTES_URL = 'https://ultraforce.dormon.net/guide/release-notes'

function getCurrentVersion(): string {
  return chrome.runtime.getManifest().version
}

async function getVersionCheckState(): Promise<VersionCheckState> {
  const state = await storageGet<VersionCheckState>(STORAGE_KEYS.VERSION_CHECK)
  return state || { lastVersion: '', hasShownNotification: false }
}

export async function checkForUpdate(): Promise<{
  hasUpdate: boolean
  currentVersion: string
}> {
  // 调试用：设为 true 强制显示更新通知
  const DEBUG_FORCE_SHOW = false

  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()

  const isNewVersion = state.lastVersion !== '' && state.lastVersion !== currentVersion
  const hasUpdate = DEBUG_FORCE_SHOW || (isNewVersion && !state.hasShownNotification)

  return { hasUpdate, currentVersion }
}

export async function markNotificationAsShown(): Promise<void> {
  const currentVersion = getCurrentVersion()
  try {
    await storageSet(STORAGE_KEYS.VERSION_CHECK, {
      lastVersion: currentVersion,
      hasShownNotification: true
    })
  } catch {
    // Ignore storage errors
  }
}
