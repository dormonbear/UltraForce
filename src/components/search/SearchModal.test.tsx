import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchModal from './SearchModal'
import type { SearchResult, NavigationMode } from '~types'

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

interface SearchModalTestProps {
  isVisible?: boolean
  onClose?: () => void
  onSearch?: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onResultClick?: (result: SearchResult) => void
  searchResults?: Record<string, SearchResult[]>
  isLoading?: boolean
  sfHost?: string | null
  hasSession?: boolean
  navigationMode?: NavigationMode
  fuzzySearch?: boolean
  searchError?: string | null
}

function renderModal(overrides: SearchModalTestProps = {}) {
  const defaultProps = {
    isVisible: true,
    onClose: vi.fn(),
    onSearch: vi.fn(),
    onResultClick: vi.fn(),
    searchResults: {},
    isLoading: false,
    sfHost: 'test.my.salesforce.com',
    hasSession: true,
    navigationMode: 'auto' as NavigationMode,
    fuzzySearch: true,
    searchError: null,
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
  })

  describe('visibility', () => {
    it('should render search input when isVisible is true', () => {
      renderModal({ isVisible: true })
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should not render when isVisible is false', () => {
      const { container } = renderModal({ isVisible: false })
      expect(container.innerHTML).toBe('')
    })
  })

  describe('search input', () => {
    it('should call onSearch when user types in input', async () => {
      const { props } = renderModal()
      const input = screen.getByRole('textbox')

      await userEvent.type(input, 'Account')

      // onSearch is debounced, so wait for it
      await waitFor(() => {
        expect(props.onSearch).toHaveBeenCalled()
      }, { timeout: 500 })
    })
  })

  describe('search results', () => {
    it('should display search results when query is set', async () => {
      const mockResults: Record<string, SearchResult[]> = {
        ApexClass: [
          { id: '001', name: 'WeatherService', type: 'ApexClass', description: 'Weather API' }
        ]
      }

      renderModal({ searchResults: mockResults })

      // Type a query so results are shown (component hides results when query empty)
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
      const mockResults = { ApexClass: [mockResult] }
      const { props } = renderModal({ searchResults: mockResults })

      // Type a query so results display
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
      const mockResults = {
        ApexClass: [
          { id: '001', name: 'ClassA', type: 'ApexClass' },
          { id: '002', name: 'ClassB', type: 'ApexClass' }
        ]
      }
      renderModal({ searchResults: mockResults })

      const input = screen.getByRole('textbox')
      // Type something so we're not in "empty query" mode
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Verify no crash and component still renders
      expect(screen.getByText('ClassA')).toBeInTheDocument()
      expect(screen.getByText('ClassB')).toBeInTheDocument()
    })

    it('should navigate up with ArrowUp key', async () => {
      const mockResults = {
        ApexClass: [
          { id: '001', name: 'ClassA', type: 'ApexClass' },
          { id: '002', name: 'ClassB', type: 'ApexClass' }
        ]
      }
      renderModal({ searchResults: mockResults })

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'test')

      // Move down then back up
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
      const { props } = renderModal({
        searchResults: { ApexClass: [mockResult] }
      })

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'test')

      fireEvent.keyDown(input, { key: 'Enter' })

      expect(props.onResultClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: '001', name: 'ClassA' })
      )
    })
  })

  describe('loading state', () => {
    it('should show loading state when isLoading is true', () => {
      renderModal({ isLoading: true })
      // EmptyState with type="loading" renders loading indicator
      const modal = screen.getByText(/loading|searching/i)
      expect(modal).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should show error message when searchError is set', async () => {
      renderModal({ searchError: 'API Error: Connection failed' })

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'test')

      expect(screen.getByText(/API Error|Connection failed/)).toBeInTheDocument()
    })
  })

  describe('no session state', () => {
    it('should show no-session state when hasSession is false', () => {
      renderModal({ hasSession: false })
      // EmptyState with type="no-session" renders login prompt
      expect(screen.getByText(/session|login|sign in/i)).toBeInTheDocument()
    })
  })

  describe('settings panel', () => {
    it('should open settings panel when settings button is clicked', async () => {
      renderModal()

      const settingsButton = screen.getByTitle('Settings')
      await userEvent.click(settingsButton)

      // Settings panel renders type checkboxes
      await waitFor(() => {
        expect(screen.getByText('Apex Classes & Triggers')).toBeInTheDocument()
      })
    })

    it('should close settings panel when Escape is pressed', async () => {
      renderModal()

      // Open settings
      const settingsButton = screen.getByTitle('Settings')
      await userEvent.click(settingsButton)

      // Verify settings is open
      await waitFor(() => {
        expect(screen.getByText('Apex Classes & Triggers')).toBeInTheDocument()
      })

      // Find the modal container and fire Escape
      const modal = document.querySelector('[data-ultraforce-modal]')
      expect(modal).toBeTruthy()
      fireEvent.keyDown(modal!, { key: 'Escape' })

      // Should be back to search view (input visible again)
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
