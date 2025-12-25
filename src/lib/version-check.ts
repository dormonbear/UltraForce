const VERSION_CHECK_KEY = 'ultraforce_version_check'
const RELEASE_NOTES_URL = 'https://ultraforce.dormon.net/guide/release-notes'

interface VersionCheckState {
  lastCheckedVersion: string
  currentVersion: string
  isDismissed: boolean
  dismissedAt?: number
  hasShownNotification?: boolean
}

function getCurrentVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return '0.0.0'
  }
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  const maxLen = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

export async function getVersionCheckState(): Promise<VersionCheckState | null> {
  try {
    const result = await chrome.storage.local.get([VERSION_CHECK_KEY])
    return result[VERSION_CHECK_KEY] || null
  } catch {
    return null
  }
}

export async function saveVersionCheckState(state: VersionCheckState): Promise<void> {
  try {
    await chrome.storage.local.set({ [VERSION_CHECK_KEY]: state })
  } catch {
    // ignore
  }
}

export async function checkForUpdate(): Promise<{
  hasUpdate: boolean
  currentVersion: string
  newVersion: string
  releaseNotesUrl: string
}> {
  // DEBUG: Set to true to force show notification for testing
  const DEBUG_FORCE_SHOW = false

  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()

  if (!state) {
    await saveVersionCheckState({
      lastCheckedVersion: currentVersion,
      currentVersion,
      isDismissed: false,
      hasShownNotification: false
    })
    return {
      hasUpdate: DEBUG_FORCE_SHOW,
      currentVersion,
      newVersion: currentVersion,
      releaseNotesUrl: RELEASE_NOTES_URL
    }
  }

  const isNewVersion = compareVersions(currentVersion, state.lastCheckedVersion) > 0
  const hasUpdate = DEBUG_FORCE_SHOW || (isNewVersion && !state.hasShownNotification)

  if (isNewVersion && !state.hasShownNotification) {
    await saveVersionCheckState({
      ...state,
      currentVersion,
      lastCheckedVersion: currentVersion
    })
  }

  return {
    hasUpdate,
    currentVersion,
    newVersion: currentVersion,
    releaseNotesUrl: RELEASE_NOTES_URL
  }
}

export async function markNotificationAsShown(): Promise<void> {
  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()
  await saveVersionCheckState({
    lastCheckedVersion: currentVersion,
    currentVersion,
    isDismissed: state?.isDismissed || false,
    dismissedAt: state?.dismissedAt,
    hasShownNotification: true
  })
}

export async function dismissUpdateNotification(): Promise<void> {
  const currentVersion = getCurrentVersion()
  await saveVersionCheckState({
    lastCheckedVersion: currentVersion,
    currentVersion,
    isDismissed: true,
    dismissedAt: Date.now(),
    hasShownNotification: true
  })
}

export async function markVersionAsSeen(): Promise<void> {
  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()

  await saveVersionCheckState({
    lastCheckedVersion: currentVersion,
    currentVersion,
    isDismissed: state?.isDismissed || false,
    dismissedAt: state?.dismissedAt
  })
}

export { RELEASE_NOTES_URL, getCurrentVersion }
