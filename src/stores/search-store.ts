// Search store - transient UI state for the search modal
// Not persisted: resets each time the modal opens

import { create } from 'zustand'
import type { SearchResult, RecordContext } from '~types'

export interface SearchState {
  isVisible: boolean
  searchResults: Record<string, SearchResult[]>
  isLoading: boolean
  searchError: string | null
  recordContext: RecordContext | null
}

interface SearchActions {
  show: () => void
  hide: () => void
  setLoading: (loading: boolean) => void
  setResults: (results: Record<string, SearchResult[]>) => void
  setError: (error: string | null) => void
  setRecordContext: (context: RecordContext | null) => void
  clearResults: () => void
  reset: () => void
}

export type SearchStore = SearchState & SearchActions

const INITIAL_STATE: SearchState = {
  isVisible: false,
  searchResults: {},
  isLoading: false,
  searchError: null,
  recordContext: null
}

export const useSearchStore = create<SearchStore>()((set) => ({
  ...INITIAL_STATE,

  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setResults: (results) => set({ searchResults: results, isLoading: false, searchError: null }),
  setError: (error) => set({ searchError: error, isLoading: false }),
  setRecordContext: (context) => set({ recordContext: context }),
  clearResults: () => set({ searchResults: {}, searchError: null }),
  reset: () => set(INITIAL_STATE)
}))
