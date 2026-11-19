import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchModal from './SearchModal'
import type { SearchResult } from '~types'
import { createKeyboardInterceptor } from '~lib/keyboard-interceptor'
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

function renderModal(overrides: RenderOptions = {}, container?: HTMLElement) {
  const defaultProps = {
    onClose: vi.fn(),
    onSearch: vi.fn(),
    onResultClick: vi.fn(),
    ...overrides
  }

  return {
    ...render(<SearchModal {...defaultProps} />, { container }),
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

  it.each(['picker', 'settings'])('keeps the outgoing %s mounted during exit / 退场期间保留该视图', async (view) => {
    vi.useFakeTimers()
    vi.stubGlobal('CSS', { supports: () => true })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    try {
      await act(async () => {
        renderModal()
      })
      const input = screen.getByRole('combobox')
      if (view === 'picker') fireEvent.keyDown(input, { key: 'Tab' })
      else fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const heading = screen.getByRole('heading', { name: view === 'picker' ? 'Choose a scope' : 'Settings' })
      fireEvent.keyDown(view === 'picker' ? input : screen.getByRole('dialog'), { key: 'Escape' })
      expect(heading).toBeInTheDocument()
      expect(heading.closest('[inert]')).not.toBeNull()
      act(() => vi.advanceTimersByTime(139))
      expect(heading).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(heading).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('opens a favorite synchronously before the exit ends / 退场结束前立即打开收藏项', async () => {
    await setFavoritesOrgScope('motion.my.salesforce.com')
    useFavoritesStore
      .getState()
      .addFavorite({ id: 'motion-nav', name: 'Motion favorite', type: 'User', url: '/motion' })
    vi.useFakeTimers()
    vi.stubGlobal('CSS', { supports: () => true })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      const { props } = renderModal()
      fireEvent.click(screen.getByTitle('Motion favorite (User)'))
      expect(open).toHaveBeenCalledWith('/motion', '_blank')
      expect(props.onClose).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTime(140))
      expect(props.onClose).toHaveBeenCalledOnce()
    } finally {
      open.mockRestore()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
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

    it('traps Tab with text and no highlighted result / 输入内容且无选中结果时将 Tab 焦点留在对话框内', () => {
      reportPersistError(
        'favorites',
        'Pin could not be saved to browser storage (browser storage may be full). It will be gone after reload.'
      )
      renderModal()
      const input = screen.getByRole('combobox')
      const dismiss = screen.getByRole('button', { name: 'Dismiss storage warning' })
      input.focus()
      fireEvent.change(input, { target: { value: 'acc' } })

      fireEvent.keyDown(input, { key: 'Tab' })
      expect(dismiss).toHaveFocus()
      fireEvent.keyDown(dismiss, { key: 'Tab' })
      expect(input).toHaveFocus()
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
      expect(dismiss).toHaveFocus()
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

      await waitFor(() => expect(props.onClose).toHaveBeenCalled())
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

  it.each([
    ['en-US', 'No Flows found for "123421"', 'No Custom Codes found for "missing"', 'No results for ":bogus 123421"'],
    ['zh-CN', '在 流程 中没有找到 "123421"', '在 自定义代码 中没有找到 "missing"', '未找到“:bogus 123421”的结果']
  ])('uses the visible scope and search text in %s / 使用可见的范围和搜索文本', (locale, flow, code, unknown) => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
    try {
      renderModal()
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: ':f 123421' } })
      expect(input).toHaveValue('123421')
      expect(screen.getByText(flow)).toBeInTheDocument()
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Backspace' })
      fireEvent.change(input, { target: { value: ':c missing' } })
      expect(screen.getByText(code)).toBeInTheDocument()
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Backspace' })
      fireEvent.change(input, { target: { value: ':bogus 123421' } })
      expect(screen.getByText(unknown)).toBeInTheDocument()
    } finally {
      languages.mockRestore()
    }
  })

  describe('no session state', () => {
    it('should show no-session state from store', () => {
      useSessionStore.getState().setSession(null, false)
      renderModal()
      expect(screen.getByText(/session|login|sign in/i)).toBeInTheDocument()
    })
  })

  describe('results mode / 结果模式', () => {
    it('morphs when visible search text changes / 根据可见搜索文本切换布局', () => {
      renderModal()
      const dialog = screen.getByRole('dialog')
      const input = screen.getByRole('combobox')
      expect(dialog).toHaveAttribute('data-ui-mode', 'idle')
      fireEvent.change(input, { target: { value: 'acc' } })
      expect(dialog).toHaveAttribute('data-ui-mode', 'results')
      fireEvent.change(input, { target: { value: '' } })
      expect(dialog).toHaveAttribute('data-ui-mode', 'idle')
      fireEvent.change(input, { target: { value: ':f ' } })
      expect(input).toHaveValue('')
      expect(dialog).toHaveAttribute('data-ui-mode', 'idle')
      fireEvent.keyDown(input, { key: 'Tab' })
      fireEvent.change(input, { target: { value: 'flo' } })
      expect(screen.getByRole('heading', { name: 'Choose a scope' })).toBeVisible()
      expect(dialog).toHaveAttribute('data-ui-mode', 'idle')
    })

    it('excludes round buttons from accessibility and focus while typing / 输入时从无障碍树和焦点循环中移除圆形按钮', () => {
      renderModal()
      const input = screen.getByRole('combobox')
      const labels = ['History', 'Favorites', 'Settings']
      const buttons = labels.map((name) => screen.getByRole('button', { name }))
      for (const button of buttons) expect(button.tabIndex).toBe(0)

      fireEvent.change(input, { target: { value: 'acc' } })
      for (const name of labels) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      fireEvent.keyDown(input, { key: 'Tab' })
      expect(input).toHaveFocus()

      fireEvent.change(input, { target: { value: '' } })
      buttons[1].focus()
      fireEvent.keyDown(buttons[1], { key: 'Tab', shiftKey: true })
      expect(buttons[0]).toHaveFocus()
      for (const name of labels) expect(screen.getByRole('button', { name })).toBeVisible()
    })

    it.each([
      ['en-US', 'Open', 'Autocomplete'],
      ['zh-CN', '打开', '自动补全']
    ])('localizes the results action pill in %s / 本地化结果操作提示', (locale, open, autocomplete) => {
      const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
      try {
        const { container } = renderModal()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acc' } })
        const pill = container.querySelector<HTMLElement>('.search-footer-pill')!
        const openHint = within(pill).getByText(open).closest('.shortcut-item')
        expect(openHint?.querySelector('kbd')).toHaveTextContent('Enter')
        const autocompleteHint = within(pill).getByText(autocomplete).closest('.shortcut-item')
        expect(autocompleteHint?.querySelector('kbd')).toHaveTextContent('Tab')
      } finally {
        languages.mockRestore()
      }
    })
  })

  describe('search bar actions / 搜索栏操作', () => {
    it('clears the query and toggles the active section / 清空查询并切换当前分区', async () => {
      renderModal()
      const input = screen.getByRole('combobox')
      await userEvent.type(input, ':f ')
      expect(input).toHaveAccessibleDescription('Scope: Flows')
      const history = screen.getByRole('button', { name: 'History', pressed: false })

      await userEvent.click(history)
      expect(input).not.toHaveAccessibleDescription()
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
      expect(history).toHaveAttribute('aria-pressed', 'true')

      await userEvent.click(history)
      expect(history).toHaveAttribute('aria-pressed', 'false')
    })

    it('clears the active section when typing / 输入时取消当前分区', async () => {
      renderModal()
      const favorites = screen.getByRole('button', { name: 'Favorites', pressed: false })

      await userEvent.click(favorites)
      expect(favorites).toHaveAttribute('aria-pressed', 'true')
      await userEvent.type(screen.getByRole('combobox'), 'account')
      expect(favorites).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('settings panel', () => {
    it('opens settings from the round bar button / 通过搜索栏圆形按钮打开设置', async () => {
      renderModal()

      const settingsButton = screen.getByRole('button', { name: 'Settings' })
      expect(settingsButton.closest('.search-bar-row')).toBeInTheDocument()
      await userEvent.click(settingsButton)

      await waitFor(() => {
        expect(screen.getByText('Apex Classes & Triggers')).toBeInTheDocument()
      })
    })

    it('should close settings panel when Escape is pressed', async () => {
      renderModal()

      const settingsButton = screen.getByRole('button', { name: 'Settings' })
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
    it('shows the scope shortcut in the footer / 在页脚显示搜索范围快捷键', () => {
      renderModal()
      expect(screen.getByText('Navigate')).toBeInTheDocument()
      expect(screen.getByText('Scopes')).toBeInTheDocument()
      expect(screen.getByText('Open')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  describe('Tab scope picker / Tab 搜索范围选择面板', () => {
    const custom = {
      key: 'fixture',
      description: 'Audit Records (recent changes)',
      isBuiltin: false as const,
      soql: 'SELECT Id FROM Account WHERE Name = {query}',
      useToolingApi: false,
      nameField: 'Name'
    }

    function openPicker() {
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'Tab' })
      expect(screen.getByRole('heading', { name: 'Choose a scope' })).toBeVisible()
      return input
    }

    it('opens on empty text and keeps Shift+Tab focus navigation / 空输入时打开面板并保留 Shift+Tab 焦点导航', () => {
      renderModal()
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()

      openPicker()
      expect(input).toHaveFocus()
      const list = screen.getByRole('listbox')
      expect(input).toHaveAttribute('aria-controls', list.id)
      expect(input).toHaveAttribute('aria-activedescendant', within(list).getAllByRole('option')[0].id)
    })

    it('hides an empty chip while filtering and restores it on Back / 筛选时隐藏空范围标签，返回时恢复', () => {
      renderModal()
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: ':f ' } })
      expect(input).toHaveAccessibleDescription('Scope: Flows')
      openPicker()
      expect(input).toHaveValue('')
      expect(input).not.toHaveAccessibleDescription()
      fireEvent.change(input, { target: { value: ':o ' } })
      expect(input).toHaveValue(':o ')
      expect(input).not.toHaveAccessibleDescription()
      fireEvent.click(screen.getByRole('button', { name: 'Back to search' }))
      expect(input).toHaveAccessibleDescription('Scope: Flows')
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
    })

    it.each([':f', ':f record', ':f  ', ':unknown ', ' '])(
      'keeps Tab in search for visible text "%s" / 有可见文本时保留 Tab 搜索行为',
      (query) => {
        renderModal()
        const input = screen.getByRole('combobox')
        fireEvent.change(input, { target: { value: query } })
        fireEvent.keyDown(input, { key: 'Tab' })
        expect(screen.queryByRole('heading', { name: 'Choose a scope' })).not.toBeInTheDocument()
        expect(screen.getByText('Autocomplete')).toBeVisible()
      }
    )

    it('lists supported built-ins in order before custom commands / 按顺序列出支持的内置指令，再列出自定义指令', async () => {
      useSettingsStore.setState({ customCommands: { fixture: custom } })
      vi.mocked(getUnsupportedTypes).mockResolvedValueOnce(['User', 'ApexClass'])
      renderModal()
      openPicker()
      await waitFor(() => expect(screen.queryByRole('option', { name: 'Users :u' })).not.toBeInTheDocument())
      const options = screen.getAllByRole('option')
      expect(options.map((option) => option.querySelector('kbd')?.textContent).join(' ')).toBe(
        ':o :c :f :p :l :m :q :r :g :fixture'
      )
      expect(options.at(-1)).toHaveAccessibleName('Audit Records :fixture')
    })

    it('filters by label, description, and key without searching / 按标签、说明和指令筛选且不发起搜索', async () => {
      useSettingsStore.setState({ customCommands: { fixture: custom } })
      const { props } = renderModal()
      const input = openPicker()
      vi.useFakeTimers()
      try {
        for (const [filter, label] of [
          ['fLo', 'Flows :f'],
          ['recent changes', 'Audit Records :fixture'],
          [':fixture', 'Audit Records :fixture']
        ]) {
          fireEvent.change(input, { target: { value: filter } })
          expect(screen.getAllByRole('option')).toHaveLength(1)
          expect(screen.getByRole('option', { name: label, selected: true })).toBeVisible()
          await act(() => vi.advanceTimersByTimeAsync(350))
        }
        expect(props.onSearch).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('wraps selection and chooses a scope with Enter / 循环移动选项并用 Enter 选择搜索范围', () => {
      renderModal()
      const input = openPicker()
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(screen.getByRole('option', { name: 'Go to Setup :g', selected: true })).toBeVisible()
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(screen.getByRole('option', { name: 'Custom Codes :c', selected: true })).toBeVisible()
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(input).toHaveAccessibleDescription('Scope: Custom Codes')
      expect(input).toHaveAttribute('data-command-prefix', ':c ')
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
    })

    it.each(['Escape', 'Tab'])('%s returns to search / 返回搜索', (key) => {
      const { props } = renderModal()
      const input = openPicker()
      fireEvent.change(input, { target: { value: 'flo' } })
      fireEvent.keyDown(input, { key })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeVisible()
      expect(input).toHaveValue('')
      expect(props.onClose).not.toHaveBeenCalled()
    })

    it('shows details on hover and chooses on click / 悬停时显示详情，点击时选择', () => {
      useSettingsStore.setState({ customCommands: { fixture: custom } })
      renderModal()
      const input = openPicker()
      fireEvent.mouseEnter(screen.getByRole('option', { name: 'Custom Codes :c' }))
      expect(screen.getByText('Custom Codes (Apex/Trigger/Visualforce/LWC/Aura)')).toBeVisible()
      expect(screen.getByText('Apex Classes')).toBeVisible()
      expect(screen.getByText('Visualforce Pages')).toBeVisible()
      fireEvent.mouseEnter(screen.getByRole('option', { name: 'Go to Setup :g' }))
      expect(screen.getByText('Setup pages')).toBeVisible()

      const option = screen.getByRole('option', { name: 'Audit Records :fixture' })
      fireEvent.mouseEnter(option)
      expect(screen.getByText('Custom SOQL command')).toBeVisible()
      fireEvent.click(option)
      expect(input).toHaveAttribute('data-command-prefix', ':fixture ')
      expect(input).toHaveFocus()
    })

    it.each([
      ['en-US', 'Choose a scope', 'Filter scopes...', 'Scopes', 'Choose', 'Back'],
      ['zh-CN', '选择搜索范围', '筛选搜索范围...', '搜索范围', '选择', '返回']
    ])(
      'localizes picker and footer in %s / 本地化选择面板及页脚',
      (locale, title, placeholder, scopes, choose, back) => {
        const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
        try {
          renderModal()
          const dialog = screen.getByRole('dialog')
          const input = screen.getByRole('combobox')
          expect(within(dialog).getByText(scopes)).toBeVisible()
          fireEvent.keyDown(input, { key: 'Tab' })
          expect(screen.getByRole('heading', { name: title })).toBeVisible()
          expect(input).toHaveAttribute('placeholder', placeholder)
          expect(screen.getByText(choose)).toBeVisible()
          expect(screen.getByText(back)).toBeVisible()
        } finally {
          languages.mockRestore()
        }
      }
    )

    it.each([false, true])('preserves Tab autocomplete with the interceptor set to %s / 保留 Tab 补全', (intercept) => {
      useSearchStore.setState({
        searchResults: { CustomObject: [{ id: 'account', name: 'Account', type: 'CustomObject' }] }
      })
      renderModal()
      const input = screen.getByRole('combobox')
      const tab = createKeyboardInterceptor(
        () => input,
        () => screen.getByRole('dialog')
      )
      const pressTab = () => {
        if (intercept) {
          act(() => tab(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })))
        } else {
          fireEvent.keyDown(input, { key: 'Tab' })
        }
      }

      fireEvent.change(input, { target: { value: 'acc' } })
      expect(screen.getByText('Autocomplete')).toBeVisible()
      pressTab()
      expect(input).toHaveValue('Account.')
      expect(screen.queryByRole('heading', { name: 'Choose a scope' })).not.toBeInTheDocument()

      act(() =>
        useSearchStore.setState({
          searchResults: {
            CustomField: [
              {
                id: 'name',
                name: 'Name',
                type: 'CustomField',
                metadata: { ObjectApiName: 'Account' }
              }
            ]
          }
        })
      )
      pressTab()
      expect(input).toHaveValue('Account.Name')
    })

    it.each(['', ':f '])('redirects host-page Tab for query "%s" / 转发主页面 Tab', (query) => {
      const host = document.createElement('div')
      const hostButton = document.createElement('button')
      document.body.append(host, hostButton)
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const container = document.createElement('div')
      shadowRoot.append(container)
      const { getByRole, queryByRole, unmount } = renderModal({}, container)
      const input = getByRole('combobox')
      fireEvent.change(input, { target: { value: query } })
      const modal = getByRole('dialog')
      const interceptor = createKeyboardInterceptor({
        getInput: () => input,
        getModal: () => modal,
        getShadowRoot: () => shadowRoot
      })
      window.addEventListener('keydown', interceptor, true)
      try {
        hostButton.focus()
        expect(fireEvent.keyDown(hostButton, { key: 'Tab', composed: true })).toBe(false)
        expect(getByRole('heading', { name: 'Choose a scope' })).toBeVisible()
        expect(shadowRoot.activeElement).toBe(input)
        hostButton.focus()
        fireEvent.keyDown(hostButton, { key: 'Tab', composed: true })
        expect(queryByRole('heading', { name: 'Choose a scope' })).not.toBeInTheDocument()
      } finally {
        window.removeEventListener('keydown', interceptor, true)
        unmount()
        host.remove()
        hostButton.remove()
      }
    })
  })

  describe('backdrop click', () => {
    it('should call onClose when backdrop is clicked', async () => {
      const { props } = renderModal()

      const backdrop = document.querySelector('.ultraforce-backdrop')
      expect(backdrop).toBeTruthy()
      fireEvent.click(backdrop!)

      await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    })
  })
})
