// Persist write failures (chrome.storage quota) for the modal banner.
//
// Deliberately NOT a persisted zustand store and NOT part of the persisted
// stores' state: zustand's persist middleware wraps setState, so writing an
// error field through a persisted store re-triggers the failing storage
// write on every attempt. Keeping the error state here breaks that loop
// and lets the SearchModal banner subscribe to it directly.

import { create } from 'zustand'

export type PersistErrorSource = 'favorites' | 'history' | 'settings'

interface PersistErrorState {
  /** Message per source; a source is present only while its last write failed. */
  errors: Partial<Record<PersistErrorSource, string>>
}

interface PersistErrorActions {
  reportPersistError: (source: PersistErrorSource, message: string) => void
  clearPersistError: (source: PersistErrorSource) => void
}

type PersistErrorStore = PersistErrorState & PersistErrorActions

export const usePersistErrorStore = create<PersistErrorStore>()((set) => ({
  errors: {},

  reportPersistError: (source, message) => set((state) => ({ errors: { ...state.errors, [source]: message } })),

  clearPersistError: (source) =>
    set((state) => {
      if (!(source in state.errors)) return state
      const errors = { ...state.errors }
      delete errors[source]
      return { errors }
    })
}))

/** Report a persist write failure for a source. No-op when already reported. */
export function reportPersistError(source: PersistErrorSource, message: string): void {
  usePersistErrorStore.getState().reportPersistError(source, message)
}

/** Clear the reported failure for a source (next successful write calls this). */
export function clearPersistError(source: PersistErrorSource): void {
  usePersistErrorStore.getState().clearPersistError(source)
}

/** Test-only helper: forget all reported errors so a fresh test starts clean. */
export function _resetPersistErrors(): void {
  usePersistErrorStore.setState({ errors: {} })
}
