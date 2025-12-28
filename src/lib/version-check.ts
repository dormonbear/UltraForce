const VERSION_CHECK_KEY = 'ultraforce_version_check'

export const RELEASE_NOTES_URL = 'https://ultraforce.dormon.net/guide/release-notes'

interface VersionCheckState {
  lastVersion: string
  hasShownNotification: boolean
  dismissedAt?: number
}

function getCurrentVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return '0.0.0'
  }
}

async function getVersionCheckState(): Promise<VersionCheckState> {
  try {
    const result = await chrome.storage.local.get([VERSION_CHECK_KEY])
    return result[VERSION_CHECK_KEY] || { lastVersion: '', hasShownNotification: false }
  } catch {
    return { lastVersion: '', hasShownNotification: false }
  }
}

async function saveVersionCheckState(state: VersionCheckState): Promise<void> {
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
  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()

  const isNewVersion = state.lastVersion !== '' && state.lastVersion !== currentVersion
  const hasUpdate = isNewVersion && !state.hasShownNotification

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
  state.lastVersion = currentVersion
  state.hasShownNotification = true
  await saveVersionCheckState(state)
}

export async function dismissUpdateNotification(): Promise<void> {
  const currentVersion = getCurrentVersion()
  const state = await getVersionCheckState()
  state.lastVersion = currentVersion
  state.hasShownNotification = true
  state.dismissedAt = Date.now()
  await saveVersionCheckState(state)
}
