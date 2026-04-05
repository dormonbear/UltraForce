import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSearchStore } from './search-store'

describe('search-store', () => {
  beforeEach(() => {
    useSearchStore.getState().reset()
  })

  describe('defaults', () => {
    it('should have correct initial state', () => {
      const state = useSearchStore.getState()

      expect(state.isVisible).toBe(false)
      expect(state.searchResults).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.searchError).toBeNull()
      expect(state.recordContext).toBeNull()
    })
  })

  describe('show / hide', () => {
    it('should set isVisible to true on show', () => {
      useSearchStore.getState().show()
      expect(useSearchStore.getState().isVisible).toBe(true)
    })

    it('should set isVisible to false on hide', () => {
      useSearchStore.getState().show()
      useSearchStore.getState().hide()
      expect(useSearchStore.getState().isVisible).toBe(false)
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      useSearchStore.getState().setLoading(true)
      expect(useSearchStore.getState().isLoading).toBe(true)

      useSearchStore.getState().setLoading(false)
      expect(useSearchStore.getState().isLoading).toBe(false)
    })
  })

  describe('setResults', () => {
    it('should set results and clear loading/error', () => {
      useSearchStore.getState().setLoading(true)
      useSearchStore.getState().setError('previous error')

      const results = { ApexClass: [{ id: '01p', name: 'Test', type: 'ApexClass' }] }
      useSearchStore.getState().setResults(results)

      const state = useSearchStore.getState()
      expect(state.searchResults).toEqual(results)
      expect(state.isLoading).toBe(false)
      expect(state.searchError).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error and clear loading', () => {
      useSearchStore.getState().setLoading(true)

      useSearchStore.getState().setError('Search failed')

      const state = useSearchStore.getState()
      expect(state.searchError).toBe('Search failed')
      expect(state.isLoading).toBe(false)
    })

    it('should clear error when set to null', () => {
      useSearchStore.getState().setError('error')
      useSearchStore.getState().setError(null)

      expect(useSearchStore.getState().searchError).toBeNull()
    })
  })

  describe('setRecordContext', () => {
    it('should set record context', () => {
      const ctx = { objectApiName: 'Account', recordId: '001abc' }
      useSearchStore.getState().setRecordContext(ctx)

      expect(useSearchStore.getState().recordContext).toEqual(ctx)
    })

    it('should clear record context with null', () => {
      useSearchStore.getState().setRecordContext({ objectApiName: 'Account', recordId: '001abc' })
      useSearchStore.getState().setRecordContext(null)

      expect(useSearchStore.getState().recordContext).toBeNull()
    })
  })

  describe('clearResults', () => {
    it('should clear results and error without affecting other state', () => {
      useSearchStore.getState().show()
      useSearchStore.getState().setResults({ ApexClass: [{ id: '1', name: 'X', type: 'ApexClass' }] })
      useSearchStore.getState().setRecordContext({ objectApiName: 'Account', recordId: '001abc' })

      useSearchStore.getState().clearResults()

      const state = useSearchStore.getState()
      expect(state.searchResults).toEqual({})
      expect(state.searchError).toBeNull()
      expect(state.isVisible).toBe(true)
      expect(state.recordContext).not.toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useSearchStore.getState().show()
      useSearchStore.getState().setResults({ ApexClass: [{ id: '1', name: 'X', type: 'ApexClass' }] })
      useSearchStore.getState().setRecordContext({ objectApiName: 'Account', recordId: '001abc' })

      useSearchStore.getState().reset()

      const state = useSearchStore.getState()
      expect(state.isVisible).toBe(false)
      expect(state.searchResults).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.searchError).toBeNull()
      expect(state.recordContext).toBeNull()
    })
  })

  describe('subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const listener = vi.fn()
      const unsub = useSearchStore.subscribe(listener)

      useSearchStore.getState().show()

      expect(listener).toHaveBeenCalledTimes(1)
      unsub()
    })
  })
})
