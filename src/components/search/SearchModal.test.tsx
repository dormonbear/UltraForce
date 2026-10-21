import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchModal from './SearchModal'
import type { SearchResult } from '~types'
import { useSettingsStore, SETTINGS_DEFAULTS } from '~stores/settings-store'
import { useSessionStore } from '~stores/session-store'
import { useSearchStore } from '~stores/search-store'
import { useFavoritesStore, setFavoritesOrgScope, _resetFavoritesOrgScope } from '~stores/favorites-store'
import { usePersistErrorStore, _resetPersistErrors, reportPersistError } from '~stores/persist-error-store'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock dependencies
vi.mock('~lib/salesforce-api', () => ({
  getUnsupportedTypes: vi.fn().mockResolvedValue([]),
  clearMetadataCache: vi.fn().mockResolvedValue(undefined),
  warmupMetadataCache: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('~lib/version-check', () => ({
  checkForUpdate: vi.fn().mockResolvedValue({ hasUpdate: false, currentVersion: '0.1.0' }),
  markNotificationAsShown: vi.fn().mockResolvedValue(undefined),
  RELEASE_NOTES_URL: 'https://example.com/releases'
}))

vi.mock('~lib/command-parser', () => ({
  parseCommand: vi.fn().mockReturnValue({ isCommand: false, query: '', types: null, commandKey: null }),
  getMatchingCommands: vi.fn().mockReturnValue([]),
  mergeCommands: vi.fn().mockReturnValue({}),
  getCommandPrefix: vi.fn().mockReturnValue(''),
  filterCommandsBySupported: vi.fn().mockReturnValue([]),
  isKeyUnique: vi.fn().mockReturnValue(true),
  validateCommandKey: vi.fn().mockReturnValue({ valid: true }),
  BUILTIN_COMMANDS: {}
}))

vi.mock('~lib/api-stats', () => ({
  getApiStats: vi.fn().mockResolvedValue({ totalRequests: 0, sessionRequests: 0 }),
  resetAllStats: vi.fn()
}))

vi.mock('./styles', () => ({
  SEARCH_MODAL_STYLES: ''
}))

vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { getUnsupportedTypes } from '~lib/salesforce-api'
import { logger } from '~lib/logger'

interface RenderOptions {
  onClose?: () => void
  onSearch?: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onResultClick?: (result: SearchResult) => void
}

function renderModal(overrides: RenderOptions = {}) {
  const defaultProps = {
    onClose: vi.fn(),
    onSearch: vi.fn(),
    onResultClick: vi.fn(),
    ...overrides
  }

  return {
    ...render(<SearchModal {...defaultProps} />),
    props: defaultProps
  }
}

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)

    // Reset stores to defaults
    useSettingsStore.setState(SETTINGS_DEFAULTS)
    _resetPersistErrors()
    _resetFavoritesOrgScope()
    useSessionStore.getState().setSession('test.my.salesforce.com', true)
    useSearchStore.setState({
      isVisible: true,
      searchResults: {},
      isLoading: false,
      searchError: null,
      recordContext: null
    })
  })

  describe('error logging', () => {
    it('logs a warning when getUnsupportedTypes rejects', async () => {
      vi.mocked(getUnsupportedTypes).mockRejectedValueOnce(new Error('boom'))
      renderModal()
      await waitFor(() => {
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
          'getUnsupportedTypes failed',
          expect.objectContaining({ error: expect.any(Error) })
        )
      })
    })
  })

  describe('storage warning banner', () => {
    it('is absent when no persist write has failed', () => {
      renderModal()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('renders a warning when a persist write failed', () => {
      reportPersistError(
        'favorites',
        'Pin could not be saved to browser storage (browser storage may be full). It will be gone after reload.'
      )
      renderModal()
      expect(screen.getByRole('alert')).toHaveTextContent(/Pin could not be saved/i)
    })

    it('dismisses the warning via its dismiss button', () => {
      reportPersistError(
        'history',
        'Recent items could not be saved to browser storage (browser storage may be full). History may be missing after reload.'
      )
      renderModal()
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss storage warning' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(usePersistErrorStore.getState().errors).toEqual({})
    })

    it('appears end-to-end when a quota-exceeded pin write fails', async () => {
      await setFavoritesOrgScope('orgA.my.salesforce.com')
      chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))
      useFavoritesStore.getState().addFavorite({ id: 'pin-1', name: 'Pinned', type: 'User', url: 'u' })

      renderModal()
      expect(await screen.findByRole('alert')).toHaveTextContent(/Pin could not be saved/i)
    })
  })

  describe('accessibility', () => {
    it('exposes the modal as a dialog with an accessible name', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAccessibleName('UltraForce search')
    })

    it('labels the search input', () => {
      renderModal()
      expect(screen.getByRole('combobox', { name: /search/i })).toBeInTheDocument()
    })

    it('labels the settings button', () => {
      renderModal()
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    })

    it('restores focus to the previously focused element on close', () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      trigger.focus()
      expect(document.activeElement).toBe(trigger)

      const { unmount } = renderModal()
      // Modal grabs focus on open
      expect(document.activeElement).not.toBe(trigger)

      unmount()
      expect(document.activeElement).toBe(trigger)
      document.body.removeChild(trigger)
    })
  })

  describe('focus reclaim', () => {
    it('pulls focus back when the host page steals it after open', async () => {
      renderModal()
      const input = screen.getByRole('combobox')
      expect(document.activeElement).toBe(input)

      const stealer = document.createElement('input')
      document.body.appendChild(stealer)
      stealer.focus()
      expect(document.activeElement).toBe(stealer)

      await waitFor(() => expect(document.activeElement).toBe(input))
      document.body.removeChild(stealer)
    })

    it('does not fight focus that moves to another control inside the modal', async () => {
      renderModal()
      const settingsButton = screen.getByRole('button', { name: 'Settings' })
      settingsButton.focus()
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(document.activeElement).toBe(settingsButton)
    })

    it('does not reclaim focus once the modal is closed', async () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      trigger.focus()
      const { unmount } = renderModal()
      unmount()
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(document.activeElement).toBe(trigger)
      document.body.removeChild(trigger)
    })

    it('tells the user to click when the page itself has no focus', async () => {
      const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false)
      renderModal()
      expect(await screen.findByPlaceholderText('Click here to focus, then type to search')).toBeInTheDocument()

      hasFocus.mockReturnValue(true)
      fireEvent(window, new Event('focus'))
      expect(await screen.findByPlaceholderText('Search test metadata...')).toBeInTheDocument()
      hasFocus.mockRestore()
    })
  })

  describe('combobox and listbox wiring', () => {
    it('exposes the search input as a collapsed combobox before a search runs', () => {
      renderModal()
      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('role', 'combobox')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).toHaveAttribute('aria-controls', 'ultraforce-results-listbox')
      expect(input).not.toHaveAttribute('aria-activedescendant')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('links the combobox to the listbox and tracks the highlighted option', async () => {
      useSearchStore.setState({
        searchResults: {
          ApexClass: [
            { id: '001', name: 'ClassA', type: 'ApexClass' },
            { id: '002', name: 'ClassB', type: 'ApexClass' }
          ]
        }
      })
      renderModal()
      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')

      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('id', 'ultraforce-results-listbox')
      expect(input).toHaveAttribute('aria-controls', 'ultraforce-results-listbox')
      expect(input).toHaveAttribute('aria-expanded', 'true')
      expect(input).toHaveAttribute('aria-activedescendant', 'ultraforce-option-0')

      const firstOption = document.getElementById('ultraforce-option-0')
      expect(firstOption).toHaveAttribute('role', 'option')
      expect(firstOption).toHaveAttribute('aria-selected', 'true')

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveAttribute('aria-activedescendant', 'ultraforce-option-1')
      expect(document.getElementById('ultraforce-option-1')).toHaveAttribute('aria-selected', 'true')
      expect(document.getElementById('ultraforce-option-0')).toHaveAttribute('aria-selected', 'false')
    })

    it('collapses the combobox and announces no results when the search is empty', async () => {
      renderModal()
      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'zzz')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('status').textContent).toBe('No results')
    })

    it('announces the result count in the live region', async () => {
      useSearchStore.setState({
        searchResults: {
          ApexClass: [
            { id: '001', name: 'ClassA', type: 'ApexClass' },
            { id: '002', name: 'ClassB', type: 'ApexClass' }
          ]
        }
      })
      renderModal()
      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')
      expect(screen.getByRole('status').textContent).toBe('2 results')
    })

    it('keeps focus inside the dialog when Tab is pressed without a highlighted result', () => {
      renderModal()
      const input = screen.getByRole('combobox')
      const modal = screen.getByRole('dialog')
      input.focus()

      fireEvent.keyDown(input, { key: 'Tab' })
      expect(modal.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).not.toBe(input)

      // Tabbing cycles through the modal's focusable controls and wraps back to the input
      let wrappedToInput = false
      for (let i = 0; i < 8; i++) {
        fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab' })
        expect(modal.contains(document.activeElement)).toBe(true)
        if (document.activeElement === input) {
          wrappedToInput = true
          break
        }
      }
      expect(wrappedToInput).toBe(true)

      // Shift+Tab from the input wraps to the last focusable control
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
      expect(modal.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).not.toBe(input)
    })

    it('traps Tab focus inside the settings panel', async () => {
      renderModal()
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const modal = screen.getByRole('dialog')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab' })
      expect(modal.contains(document.activeElement)).toBe(true)
    })
  })

  describe('visibility', () => {
    it('should render search input when store isVisible is true', () => {
      renderModal()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should not render when store isVisible is false', () => {
      useSearchStore.setState({ isVisible: false })
      const { container } = renderModal()
      expect(container.innerHTML).toBe('')
    })
  })

  describe('search input', () => {
    it('should call onSearch when user types in input', async () => {
      const { props } = renderModal()
      const input = screen.getByRole('combobox')

      await userEvent.type(input, 'Account')

      await waitFor(
        () => {
          expect(props.onSearch).toHaveBeenCalled()
        },
        { timeout: 500 }
      )
    })
  })

  describe('search results', () => {
    it('should display search results from store', async () => {
      const mockResults: Record<string, SearchResult[]> = {
        ApexClass: [{ id: '001', name: 'WeatherService', type: 'ApexClass', description: 'Weather API' }]
      }

      useSearchStore.setState({ searchResults: mockResults })
      renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'Weather')

      await waitFor(() => {
        expect(screen.getByText('WeatherService')).toBeInTheDocument()
      })
    })

    it('should call onResultClick when result is clicked', async () => {
      const mockResult: SearchResult = {
        id: '001',
        name: 'WeatherService',
        type: 'ApexClass',
        description: 'Weather API'
      }
      useSearchStore.setState({ searchResults: { ApexClass: [mockResult] } })
      const { props } = renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'Weather')

      await waitFor(() => {
        expect(screen.getByText('WeatherService')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('WeatherService'))

      expect(props.onResultClick).toHaveBeenCalledWith(expect.objectContaining({ id: '001', name: 'WeatherService' }))
    })
  })

  describe('keyboard navigation', () => {
    it('should call onClose when Escape key is pressed', async () => {
      const { props } = renderModal()
      const input = screen.getByRole('combobox')

      fireEvent.keyDown(input, { key: 'Escape' })

      expect(props.onClose).toHaveBeenCalled()
    })

    it('should navigate down with ArrowDown key', async () => {
      useSearchStore.setState({
        searchResults: {
          ApexClass: [
            { id: '001', name: 'ClassA', type: 'ApexClass' },
            { id: '002', name: 'ClassB', type: 'ApexClass' }
          ]
        }
      })
      renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      expect(screen.getByText('ClassA')).toBeInTheDocument()
      expect(screen.getByText('ClassB')).toBeInTheDocument()
    })

    it('should navigate up with ArrowUp key', async () => {
      useSearchStore.setState({
        searchResults: {
          ApexClass: [
            { id: '001', name: 'ClassA', type: 'ApexClass' },
            { id: '002', name: 'ClassB', type: 'ApexClass' }
          ]
        }
      })
      renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      expect(screen.getByText('ClassA')).toBeInTheDocument()
    })

    it('should trigger onResultClick with Enter on selected item', async () => {
      const mockResult: SearchResult = {
        id: '001',
        name: 'ClassA',
        type: 'ApexClass'
      }
      useSearchStore.setState({ searchResults: { ApexClass: [mockResult] } })
      const { props } = renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'Enter' })

      expect(props.onResultClick).toHaveBeenCalledWith(expect.objectContaining({ id: '001', name: 'ClassA' }))
    })
  })

  describe('loading state', () => {
    it('should show loading state from store', () => {
      useSearchStore.setState({ isLoading: true })
      renderModal()
      const modal = screen.getByText(/loading|searching/i)
      expect(modal).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should show error message from store', async () => {
      useSearchStore.setState({ searchError: 'API Error: Connection failed' })
      renderModal()

      const input = screen.getByRole('combobox')
      await userEvent.type(input, 'test')

      expect(screen.getByText(/API Error|Connection failed/)).toBeInTheDocument()
    })
  })

  describe('no session state', () => {
    it('should show no-session state from store', () => {
      useSessionStore.getState().setSession(null, false)
      renderModal()
      expect(screen.getByText(/session|login|sign in/i)).toBeInTheDocument()
    })
  })

  describe('settings panel', () => {
    it('should open settings panel when settings button is clicked', async () => {
      renderModal()

      const settingsButton = screen.getByTitle('Settings')
      await userEvent.click(settingsButton)

      await waitFor(() => {
        expect(screen.getByText('Apex Classes & Triggers')).toBeInTheDocument()
      })
    })

    it('should close settings panel when Escape is pressed', async () => {
      renderModal()

      const settingsButton = screen.getByTitle('Settings')
      await userEvent.click(settingsButton)

      await waitFor(() => {
        expect(screen.getByText('Apex Classes & Triggers')).toBeInTheDocument()
      })

      const modal = document.querySelector('[data-ultraforce-modal]')
      expect(modal).toBeTruthy()
      fireEvent.keyDown(modal!, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })
  })

  describe('footer shortcuts', () => {
    it('should display keyboard shortcuts in footer', () => {
      renderModal()
      expect(screen.getByText('Navigate')).toBeInTheDocument()
      expect(screen.getByText('Autocomplete')).toBeInTheDocument()
      expect(screen.getByText('Open')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  describe('backdrop click', () => {
    it('should call onClose when backdrop is clicked', async () => {
      const { props } = renderModal()

      const backdrop = document.querySelector('.ultraforce-backdrop')
      expect(backdrop).toBeTruthy()
      fireEvent.click(backdrop!)

      expect(props.onClose).toHaveBeenCalled()
    })
  })
})
