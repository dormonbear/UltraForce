import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionStore } from './session-store'

describe('session-store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  describe('defaults', () => {
    it('should have correct initial state', () => {
      const state = useSessionStore.getState()

      expect(state.sfHost).toBeNull()
      expect(state.hasSession).toBe(false)
      expect(state.userLightningPreference).toBeNull()
    })
  })

  describe('setSession', () => {
    it('should set sfHost and hasSession together', () => {
      useSessionStore.getState().setSession('myorg.my.salesforce.com', true)

      const state = useSessionStore.getState()
      expect(state.sfHost).toBe('myorg.my.salesforce.com')
      expect(state.hasSession).toBe(true)
    })

    it('should handle null sfHost', () => {
      useSessionStore.getState().setSession(null, false)

      const state = useSessionStore.getState()
      expect(state.sfHost).toBeNull()
      expect(state.hasSession).toBe(false)
    })
  })

  describe('setLightningPreference', () => {
    it('should set lightning preference', () => {
      useSessionStore.getState().setLightningPreference(true)

      expect(useSessionStore.getState().userLightningPreference).toBe(true)
    })

    it('should accept null for unknown preference', () => {
      useSessionStore.getState().setLightningPreference(true)
      useSessionStore.getState().setLightningPreference(null)

      expect(useSessionStore.getState().userLightningPreference).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useSessionStore.getState().setSession('test.salesforce.com', true)
      useSessionStore.getState().setLightningPreference(true)

      useSessionStore.getState().reset()

      const state = useSessionStore.getState()
      expect(state.sfHost).toBeNull()
      expect(state.hasSession).toBe(false)
      expect(state.userLightningPreference).toBeNull()
    })
  })

  describe('subscriptions', () => {
    it('should notify subscribers on session change', () => {
      const listener = vi.fn()
      const unsub = useSessionStore.subscribe(listener)

      useSessionStore.getState().setSession('test.salesforce.com', true)

      expect(listener).toHaveBeenCalledTimes(1)
      unsub()
    })
  })
})
