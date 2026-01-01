const VERSION_CHECK_KEY = 'ultraforce_version_check'

export const RELEASE_NOTES_URL = 'https://ultraforce.dormon.net/guide/release-notes'

interface VersionCheckState {
  lastVersion: string
  hasShownNotification: boolean
}

function getCurrentVersion(): string {
  return chrome.runtime.getManifest().version
}

async function getVersionCheckState(): Promise<VersionCheckState> {
  try {
    const result = await chrome.storage.local.get([VERSION_CHECK_KEY])
    return result[VERSION_CHECK_KEY] || { lastVersion: '', hasShownNotification: false }
  } catch {
    return { lastVersion: '', hasShownNotification: false }
  }
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
    await chrome.storage.local.set({
      [VERSION_CHECK_KEY]: { lastVersion: currentVersion, hasShownNotification: true }
    })
  } catch {
    // ignore
  }
}
