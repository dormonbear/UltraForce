import { useSearchStore } from '~stores/search-store'
import { useSessionStore } from '~stores/session-store'
import { useSettingsStore } from '~stores/settings-store'
import { logger } from './logger'
import { buildSetupUrl, getCurrentRecordFromUrl, isChinaDomain, shouldUseLightning } from './url-builder'
import {
  fetchRecordTypeId as fetchRecordTypeIdFn,
  resolveObjectApiNameFromRecord as resolveObjectApiNameFromRecordFn,
  getCurrentRecordLayoutInfo as getCurrentRecordLayoutInfoFn,
  getUserLightningPreference as getUserLightningPreferenceFn,
  handleFieldsNavigation as handleFieldsNavigationFn,
  handleRecordTypeNavigation as handleRecordTypeNavigationFn
} from './record-context'

export async function fetchRecordTypeId(objectApiName: string | null, recordId: string): Promise<void> {
  const { sfHost } = useSessionStore.getState()
  if (!sfHost || !objectApiName) return
  const recordTypeId = await fetchRecordTypeIdFn(sfHost, objectApiName, recordId)
  if (recordTypeId) {
    const ctx = useSearchStore.getState().recordContext
    if (ctx) {
      useSearchStore.getState().setRecordContext({ ...ctx, recordTypeId })
    }
  }
}

export async function handleFieldsNavigation(hide: () => Promise<void>): Promise<void> {
  const { recordContext } = useSearchStore.getState()
  if (!recordContext?.objectApiName) {
    useSearchStore.getState().setError('No object found for this record.')
    return
  }
  useSearchStore.getState().setLoading(true)
  try {
    const { sfHost } = useSessionStore.getState()
    const { navigationMode } = useSettingsStore.getState()
    const { userLightningPreference } = useSessionStore.getState()
    const url = await handleFieldsNavigationFn(
      sfHost!,
      recordContext.objectApiName,
      navigationMode,
      userLightningPreference
    )
    if (url) {
      useSearchStore.getState().setLoading(false)
      window.open(url, '_blank')
      if (useSettingsStore.getState().closeOnNavigate) {
        void hide()
      }
      return
    }
    useSearchStore.getState().setError('Could not determine Fields URL.')
  } catch (error) {
    logger.error('Failed to navigate to Fields:', error)
    useSearchStore.getState().setError('Failed to load Fields information.')
  }
}

export async function handleRecordTypeNavigation(hide: () => Promise<void>): Promise<void> {
  const { recordContext } = useSearchStore.getState()
  if (!recordContext?.recordTypeId || !recordContext?.objectApiName) {
    useSearchStore.getState().setError('No RecordType found for this record.')
    return
  }
  useSearchStore.getState().setLoading(true)
  try {
    const { sfHost } = useSessionStore.getState()
    const { navigationMode } = useSettingsStore.getState()
    const { userLightningPreference } = useSessionStore.getState()
    const url = await handleRecordTypeNavigationFn(
      sfHost!,
      recordContext.objectApiName,
      recordContext.recordTypeId,
      navigationMode,
      userLightningPreference
    )
    if (url) {
      useSearchStore.getState().setLoading(false)
      window.open(url, '_blank')
      if (useSettingsStore.getState().closeOnNavigate) {
        void hide()
      }
      return
    }
    useSearchStore.getState().setError('Could not determine RecordType URL.')
  } catch (error) {
    logger.error('Failed to navigate to RecordType:', error)
    useSearchStore.getState().setError('Failed to load RecordType information.')
  }
}

export async function handlePageLayoutNavigation(
  getLayout: typeof getCurrentRecordLayoutUrl,
  hide: () => Promise<void>
): Promise<void> {
  useSearchStore.getState().setLoading(true)
  try {
    const result = await getLayout()
    if (result) {
      useSearchStore.getState().setLoading(false)
      window.open(result.url, '_blank')
      if (useSettingsStore.getState().closeOnNavigate) {
        void hide()
      }
      return
    }
    useSearchStore.getState().setError('Could not determine page layout for this record.')
  } catch (error) {
    logger.error('Failed to navigate to page layout:', error)
    useSearchStore.getState().setError('Failed to load page layout information.')
  }
}

export async function getCurrentRecordLayoutUrl(): Promise<{ objectApiName: string; url: string } | null> {
  const { sfHost } = useSessionStore.getState()
  const { navigationMode } = useSettingsStore.getState()
  const { userLightningPreference } = useSessionStore.getState()

  const { objectApiName: fromUrlObject, recordId } = getCurrentRecordFromUrl()
  const objectApiName =
    fromUrlObject || (recordId && sfHost ? await resolveObjectApiNameFromRecordFn(sfHost, recordId) : null)
  if (!sfHost || !objectApiName || !recordId) return null
  const layoutInfo = await getCurrentRecordLayoutInfoFn(sfHost, objectApiName, recordId)
  if (!layoutInfo) return null
  // China (Alibaba) domains use the Lightning layout editor. / 中国（阿里云）域名使用 Lightning 布局编辑器。
  const useLightning = shouldUseLightning(navigationMode, userLightningPreference) || isChinaDomain(sfHost)
  const url = useLightning
    ? buildSetupUrl(
        sfHost,
        `/lightning/setup/ObjectManager/${layoutInfo.objectDurableId}/PageLayouts/${layoutInfo.layoutId}/view`
      )
    : `https://${sfHost}/layouteditor/layoutEditor.apexp?type=${layoutInfo.objectApiName}&lid=${layoutInfo.layoutId}&retURL=%2F${layoutInfo.recordId}`
  if (!url) return null
  return { objectApiName: layoutInfo.objectApiName, url }
}

export async function resolveObjectApiNameFromRecord(recordId: string): Promise<string | null> {
  const { sfHost } = useSessionStore.getState()
  if (!sfHost) return null
  return resolveObjectApiNameFromRecordFn(sfHost, recordId)
}

export async function fetchLightningPreference(): Promise<boolean | null> {
  const { sfHost } = useSessionStore.getState()
  if (!sfHost) return null
  const pref = await getUserLightningPreferenceFn(sfHost)
  if (pref !== null) {
    useSessionStore.getState().setLightningPreference(pref)
  }
  return pref
}
