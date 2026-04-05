// Session store - page-derived state populated during init/show
// Not persisted: re-derived from auth/cookies each page load

import { create } from 'zustand'

export interface SessionState {
  sfHost: string | null
  hasSession: boolean
  userLightningPreference: boolean | null
}

interface SessionActions {
  setSession: (sfHost: string | null, hasSession: boolean) => void
  setLightningPreference: (pref: boolean | null) => void
  reset: () => void
}

export type SessionStore = SessionState & SessionActions

const INITIAL_STATE: SessionState = {
  sfHost: null,
  hasSession: false,
  userLightningPreference: null
}

export const useSessionStore = create<SessionStore>()((set) => ({
  ...INITIAL_STATE,

  setSession: (sfHost, hasSession) => set({ sfHost, hasSession }),
  setLightningPreference: (pref) => set({ userLightningPreference: pref }),
  reset: () => set(INITIAL_STATE)
}))
