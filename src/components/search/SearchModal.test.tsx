import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchModal from './SearchModal'
import type { SearchResult } from '~types'
import { useSettingsStore, SETTINGS_DEFAULTS } from '~stores/settings-store'
import { useSessionStore } from '~stores/session-store'
import { useSearchStore } from '~stores/search-store'

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
      expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
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

  describe('visibility', () => {
    it('should render search input when store isVisible is true', () => {
      renderModal()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
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
      const input = screen.getByRole('textbox')

      await userEvent.type(input, 'Account')

      await waitFor(() => {
        expect(props.onSearch).toHaveBeenCalled()
      }, { timeout: 500 })
    })
  })

  describe('search results', () => {
    it('should display search results from store', async () => {
      const mockResults: Record<string, SearchResult[]> = {
        ApexClass: [
          { id: '001', name: 'WeatherService', type: 'ApexClass', description: 'Weather API' }
        ]
      }

      useSearchStore.setState({ searchResults: mockResults })
      renderModal()

      const input = screen.getByRole('textbox')
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

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Weather')

      await waitFor(() => {
        expect(screen.getByText('WeatherService')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('WeatherService'))

      expect(props.onResultClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: '001', name: 'WeatherService' })
      )
    })
  })

  describe('keyboard navigation', () => {
    it('should call onClose when Escape key is pressed', async () => {
      const { props } = renderModal()
      const input = screen.getByRole('textbox')

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

      const input = screen.getByRole('textbox')
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

      const input = screen.getByRole('textbox')
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

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'Enter' })

      expect(props.onResultClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: '001', name: 'ClassA' })
      )
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

      const input = screen.getByRole('textbox')
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
        expect(screen.getByRole('textbox')).toBeInTheDocument()
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
