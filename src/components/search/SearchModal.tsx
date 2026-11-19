import { browserLocale, t } from '~lib/i18n'
import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, type Ref } from 'react'
import type { SearchResult } from '~types'
import { isCustomCommand } from '~types'
import SearchInput from './SearchInput'
import SearchBarActions, { type HomeSection } from './SearchBarActions'
import SearchResults from './SearchResults'
import SettingsPanel from './SettingsPanel'
import UpdateNotification from './UpdateNotification'
import EmptyState from './EmptyState'
import HomeScreen from './HomeScreen'
import IdPreview from './IdPreview'
import CommandHints from './CommandHints'
import CommandPanel, { COMMAND_LISTBOX_ID, getCommandOptionId } from './CommandPanel'
import { useCommandPanel } from './useCommandPanel'
import { getAutocompleteQuery } from './autocomplete-query'
import { RecordActions, SearchFooter, StorageWarning, type RecordAction } from './SearchChrome'
import { SEARCH_MODAL_STYLES } from './styles'
import { getInterFontFaces } from '~lib/font-loader'
import { logger } from '~lib/logger'
import { parseCommand, getMatchingCommands, mergeCommands } from '~lib/command-parser'
import { getUnsupportedTypes } from '~lib/salesforce-api'
import { extractSalesforceId, extractAllSalesforceIds } from '~lib/id-utils'
import { getRecordSuggestions, getSetupSuggestions, isSetupPage } from '~lib/contextual-suggestions'
import { SETUP_SHORTCUTS } from '~lib/setup-shortcuts'
import { checkForUpdate, markNotificationAsShown, RELEASE_NOTES_URL } from '~lib/version-check'
import { useSettingsStore, SETTINGS_DEFAULTS } from '~stores/settings-store'
import { useSessionStore } from '~stores/session-store'
import { useSearchStore } from '~stores/search-store'
import { useFavoritesStore } from '~stores/favorites-store'
import { useHistoryStore } from '~stores/history-store'
import { usePersistErrorStore, type PersistErrorSource } from '~stores/persist-error-store'
import type { ObjectAction } from './ResultItem'
import AnimatedPanel from './motion/AnimatedPanel'
import { useExitAnimation, type ExitAnimationControl } from './motion/useExitAnimation'

// Bound on refocus attempts per open so a host page that keeps re-focusing itself cannot start a fight.
const MAX_FOCUS_RECLAIMS = 5

/** id of the results listbox; the combobox input references it via aria-controls. */
const RESULTS_LISTBOX_ID = 'ultraforce-results-listbox'

interface SearchModalProps {
  onClose: () => void
  exitControl?: Ref<ExitAnimationControl>
  onSearch: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onCustomSearch?: (
    soqlTemplate: string,
    query: string,
    useToolingApi: boolean,
    nameField: string,
    descriptionFields?: string[]
  ) => void
  onSetupSearch?: (query: string) => void
  onResultClick: (result: SearchResult) => void
  onIdNavigate?: (id: string) => void
  onActionClick?: (result: SearchResult, action: ObjectAction) => void
  onNavigate?: (url: string) => void
  onPageLayoutClick?: () => void
  onRecordTypeClick?: () => void
  onFieldsClick?: () => void
}

const SearchModal: React.FC<SearchModalProps> = ({
  onClose,
  exitControl,
  onSearch,
  onCustomSearch,
  onSetupSearch,
  onResultClick,
  onIdNavigate,
  onActionClick,
  onNavigate,
  onPageLayoutClick,
  onRecordTypeClick,
  onFieldsClick
}) => {
  // --- Store subscriptions ---
  const {
    selectedTypes: rawSelectedTypes,
    shortcutKey,
    closeOnNavigate,
    autoLoadFields,
    navigationMode,
    fuzzySearch,
    hideManagedPackage,
    maxResultsPerType,
    customCommands,
    managedKeys,
    setSelectedTypes,
    updateSettings,
    setNavigationMode: storeSetNavMode,
    setFuzzySearch: storeSetFuzzy,
    setCustomCommands
  } = useSettingsStore()

  // Guard against empty selectedTypes from corrupted storage or stale persist data
  const selectedTypes = rawSelectedTypes?.length > 0 ? rawSelectedTypes : SETTINGS_DEFAULTS.selectedTypes

  const { sfHost, hasSession } = useSessionStore()
  const { isVisible, searchResults, isLoading, searchError, recordContext } = useSearchStore()
  const clearResults = useSearchStore((s) => s.clearResults)

  const { closing, close, cancel } = useExitAnimation(onClose)
  useImperativeHandle(exitControl, () => ({ close, cancel }), [close, cancel])

  // --- HomeScreen integration ---
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const favoriteItems = useFavoritesStore((s) => s.items)
  const removeHistoryItem = useHistoryStore((s) => s.removeItem)

  // Both views show storage-write failures until dismissed or a successful retry.
  // 搜索和设置均展示存储写入失败，直至关闭提示或重试成功。
  const persistErrors = usePersistErrorStore((s) => s.errors)
  const clearPersistError = usePersistErrorStore((s) => s.clearPersistError)
  const storageWarnings = useMemo(
    () => Object.values(persistErrors).filter((m): m is string => Boolean(m)),
    [persistErrors]
  )
  const dismissStorageWarnings = useCallback(() => {
    for (const source of Object.keys(persistErrors) as PersistErrorSource[]) {
      clearPersistError(source)
    }
  }, [persistErrors, clearPersistError])

  const isFavoriteCheck = useCallback((id: string) => favoriteItems.some((i) => i.id === id), [favoriteItems])

  const handleToggleFavorite = useCallback(
    (item: Omit<import('~stores/favorites-store').FavoriteItem, 'pinnedAt'>) => {
      toggleFavorite(item)
    },
    [toggleFavorite]
  )

  const handleRemoveHistoryItem = useCallback(
    (id: string) => {
      removeHistoryItem(id)
    },
    [removeHistoryItem]
  )

  const handleHomeNavigate = useCallback(
    (url: string) => {
      if (onNavigate) {
        onNavigate(url)
      } else {
        window.open(url, '_blank')
      }
      if (closeOnNavigate) {
        void close()
      }
    },
    [onNavigate, closeOnNavigate, close]
  )

  // Track whether settings store has hydrated from chrome.storage
  const [settingsReady, setSettingsReady] = useState(() => useSettingsStore.persist.hasHydrated())
  useEffect(() => {
    if (settingsReady) return
    const unsub = useSettingsStore.persist.onFinishHydration(() => setSettingsReady(true))
    return unsub
  }, [settingsReady])

  // --- Local UI state ---
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<HomeSection | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [previousResults, setPreviousResults] = useState(searchResults)
  const [showSettings, setShowSettings] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [_visibleItemCount, setVisibleItemCount] = useState(0)
  const [unsupportedTypes, setUnsupportedTypes] = useState<string[]>([])
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  // Element that had focus in the host page before the modal opened; restored on close.
  // Captured during the first render (lazy useState initializer) because the input's
  // autoFocus steals focus before effects run.
  const [previouslyFocused] = useState<Element | null>(() => document.activeElement)

  // Restore host-page focus when the modal unmounts/closes.
  useEffect(() => {
    return () => {
      const previous = previouslyFocused as HTMLElement | null
      if (previous && typeof previous.focus === 'function') {
        previous.focus()
      }
    }
  }, [previouslyFocused])

  // Focus management
  useEffect(() => {
    if (isVisible) {
      if (showSettings && modalRef.current) {
        modalRef.current.focus()
      } else if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isVisible, showSettings])

  // The host page can steal focus after the modal opened (a component mounting late, an
  // iframe finishing its load). Pull it back unless focus moved to another modal control.
  useEffect(() => {
    const input = inputRef.current
    if (!isVisible || showSettings || !input) return
    let reclaims = 0
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null
      if (next && modalRef.current?.contains(next)) return
      if (reclaims++ >= MAX_FOCUS_RECLAIMS) return
      requestAnimationFrame(() => {
        if (input.isConnected && useSearchStore.getState().isVisible) {
          input.focus()
        }
      })
    }
    input.addEventListener('focusout', handleFocusOut)
    return () => input.removeEventListener('focusout', handleFocusOut)
  }, [isVisible, showSettings])

  // When the browser UI (omnibox, DevTools) holds focus, focus() cannot bring it back to
  // the page; the only remedy is a click, so say so in the placeholder until it happens.
  const [pageHasFocus, setPageHasFocus] = useState(true)
  useEffect(() => {
    setPageHasFocus(document.hasFocus())
    const handleWindowFocus = () => setPageHasFocus(true)
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  // Refs to avoid re-triggering useEffect on callback changes
  const onSearchRef = React.useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  // Load unsupported types for current org
  useEffect(() => {
    if (sfHost) {
      getUnsupportedTypes(sfHost)
        .then(setUnsupportedTypes)
        .catch((error) => logger.warn('getUnsupportedTypes failed', { error }))
    }
  }, [sfHost])

  // Check for version updates (only on first mount)
  const hasCheckedUpdate = useRef(false)
  useEffect(() => {
    if (isVisible && !hasCheckedUpdate.current) {
      hasCheckedUpdate.current = true
      checkForUpdate()
        .then(({ hasUpdate, currentVersion }) => {
          if (hasUpdate) {
            setShowUpdateNotification(true)
            setUpdateVersion(currentVersion)
            markNotificationAsShown().catch((error) => logger.warn('markNotificationAsShown failed', { error }))
          }
        })
        .catch((error) => logger.warn('checkForUpdate failed', { error }))
    }
  }, [isVisible])

  // Merge builtin and custom commands
  const allCommands = useMemo(() => mergeCommands(customCommands), [customCommands])

  const commandPanel = useCommandPanel(query, allCommands, unsupportedTypes, handleQueryChange, inputRef)
  const pickerOpen = commandPanel.isOpen
  const hasText = !pickerOpen && !commandPanel.canOpen

  // Parse command from query
  const parsedCommand = useMemo(() => parseCommand(query, allCommands), [query, allCommands])
  const matchingCommands = useMemo(
    () => getMatchingCommands(query, allCommands, unsupportedTypes),
    [query, allCommands, unsupportedTypes]
  )
  const extractedId = useMemo(() => extractSalesforceId(query.trim()), [query])
  const extractedIds = useMemo(() => extractAllSalesforceIds(query.trim()), [query])
  const setupSuggestions = useMemo(
    () => (isSetupPage(window.location.pathname) ? getSetupSuggestions(window.location.pathname, SETUP_SHORTCUTS) : []),
    []
  )

  const showCommandHints = /^:\S*$/.test(query) && matchingCommands.length > 0

  // Clear results when entering a new command
  const prevCommandKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const currentKey = parsedCommand.isCommand ? parsedCommand.commandKey : null
    if (currentKey !== prevCommandKeyRef.current) {
      prevCommandKeyRef.current = currentKey
      if (currentKey !== null) {
        clearResults()
      }
    }
  }, [parsedCommand.isCommand, parsedCommand.commandKey, clearResults])

  const onCustomSearchRef = React.useRef(onCustomSearch)
  useEffect(() => {
    onCustomSearchRef.current = onCustomSearch
  }, [onCustomSearch])

  const onSetupSearchRef = React.useRef(onSetupSearch)
  useEffect(() => {
    onSetupSearchRef.current = onSetupSearch
  }, [onSetupSearch])

  useEffect(() => {
    if (pickerOpen) return
    const searchQuery = parsedCommand.isCommand ? parsedCommand.query : query
    const isSetupCommand = parsedCommand.isCommand && parsedCommand.command?.key === 'g'

    // Setup shortcuts command (local, no API) - allow empty query and no session check
    if (isSetupCommand) {
      onSetupSearchRef.current?.(searchQuery)
      return
    }

    // Other commands require query and session
    if (!searchQuery.trim() || !hasSession) {
      return
    }

    // Check if this is a custom command
    if (parsedCommand.isCommand && parsedCommand.command && isCustomCommand(parsedCommand.command)) {
      const customCmd = parsedCommand.command
      const debounceTimer = setTimeout(() => {
        onCustomSearchRef.current?.(
          customCmd.soql,
          searchQuery,
          customCmd.useToolingApi,
          customCmd.nameField,
          customCmd.descriptionFields
        )
      }, 300)
      return () => clearTimeout(debounceTimer)
    }

    // Wait for settings store hydration before normal search (respect user's selected types)
    if (!settingsReady) {
      return
    }

    // Builtin command or normal search
    const searchTypes = parsedCommand.types || selectedTypes
    if (searchTypes.length === 0) {
      return
    }

    const debounceTimer = setTimeout(() => {
      onSearchRef.current(searchQuery, searchTypes, fuzzySearch, hideManagedPackage)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [pickerOpen, query, parsedCommand, selectedTypes, hasSession, fuzzySearch, hideManagedPackage, settingsReady])

  if (previousResults !== searchResults) {
    setPreviousResults(searchResults)
    setSelectedIndex(0)
    setCollapsedGroups({})
  }

  // Apply maxResultsPerType limit
  const limitedSearchResults = useMemo(() => {
    const limited: Record<string, SearchResult[]> = {}
    Object.entries(searchResults).forEach(([type, typeResults]) => {
      limited[type] = typeResults.slice(0, maxResultsPerType)
    })
    return limited
  }, [searchResults, maxResultsPerType])

  const visibleResults = useMemo(() => {
    const items: SearchResult[] = []
    Object.entries(limitedSearchResults).forEach(([type, typeResults]) => {
      if (typeResults.length === 0) return
      if (!collapsedGroups[type]) {
        items.push(...typeResults)
      }
    })
    return items
  }, [limitedSearchResults, collapsedGroups])

  const handleToggleCollapse = useCallback((type: string) => {
    setCollapsedGroups((prev) => {
      const newState = { ...prev, [type]: !prev[type] }
      return newState
    })
    setSelectedIndex(0)
  }, [])

  const handleVisibleCountChange = useCallback((count: number) => {
    setVisibleItemCount(count)
  }, [])

  // Record actions available when on a record page
  const recordActions = useMemo(() => {
    if (!recordContext) return []
    const actions: RecordAction[] = []
    if (onPageLayoutClick) {
      actions.push({ id: 'page-layout', name: t('Page Layout'), handler: onPageLayoutClick, icon: 'layout' })
    }
    if (recordContext.recordTypeId && onRecordTypeClick) {
      actions.push({ id: 'record-type', name: t('Record Type'), handler: onRecordTypeClick, icon: 'type' })
    }
    if (onFieldsClick) {
      actions.push({ id: 'fields', name: t('Fields'), handler: onFieldsClick, icon: 'fields' })
    }
    // Contextual suggestions (URL-based, no API calls)
    if (sfHost) {
      const suggestions = getRecordSuggestions(recordContext, sfHost)
      for (const s of suggestions) {
        actions.push({
          id: s.id,
          name: s.name,
          handler: () => onNavigate?.(s.url),
          icon: s.icon,
          description: s.description
        })
      }
    }
    return actions
  }, [recordContext, sfHost, onPageLayoutClick, onRecordTypeClick, onFieldsClick, onNavigate])

  // Track selected record action index (separate from search results)
  const [selectedRecordActionIndex, setSelectedRecordActionIndex] = useState(-1)

  const handleDismissUpdate = useCallback(() => {
    setShowUpdateNotification(false)
  }, [])

  /**
   * Wraps Tab/Shift+Tab between the focusable controls inside the modal so
   * focus cannot escape into the host page (dialog focus trap).
   * Works inside the shadow root because event.target is the focused element.
   */
  const trapFocus = (event: React.KeyboardEvent, forward: boolean) => {
    const modal = modalRef.current
    if (!modal) return
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && !el.closest('[inert]'))
    if (focusables.length === 0) return
    const currentIndex = focusables.indexOf(event.target as HTMLElement)
    const next = forward
      ? (focusables[currentIndex + 1] ?? focusables[0])
      : (focusables[currentIndex - 1] ?? focusables[focusables.length - 1])
    event.preventDefault()
    event.stopPropagation()
    next.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // When settings panel is open, only handle Escape to close it and Tab to trap focus
    if (showSettings) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setShowSettings(false)
      } else if (event.key === 'Tab') {
        trapFocus(event, !event.shiftKey)
      }
      return
    }

    if (commandPanel.handleKeyDown(event)) return
    if (pickerOpen && event.key === 'Tab') {
      trapFocus(event, !event.shiftKey)
      return
    }

    // When query is empty and we have record actions, handle navigation for record actions
    const isInRecordActionsMode = !query.trim() && recordActions.length > 0 && hasSession && !isLoading

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        void close()
        break

      case 'ArrowDown':
        event.preventDefault()
        if (isInRecordActionsMode) {
          setSelectedRecordActionIndex((prev) => Math.min(prev + 1, recordActions.length - 1))
        } else {
          setSelectedIndex((prev) => Math.min(prev + 1, visibleResults.length - 1))
        }
        break

      case 'ArrowUp':
        event.preventDefault()
        if (isInRecordActionsMode) {
          setSelectedRecordActionIndex((prev) => Math.max(prev - 1, 0))
        } else {
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
        }
        break

      case 'Enter':
        event.preventDefault()
        if (isInRecordActionsMode && recordActions[selectedRecordActionIndex]) {
          recordActions[selectedRecordActionIndex].handler()
        } else if (extractedId && onIdNavigate) {
          onIdNavigate(extractedId)
        } else if (visibleResults[selectedIndex]) {
          onResultClick(visibleResults[selectedIndex])
        }
        break

      case 'Tab':
        if (visibleResults[selectedIndex]) {
          event.preventDefault()
          const completion = getAutocompleteQuery(visibleResults[selectedIndex], parsedCommand)
          if (completion !== undefined) setQuery(completion)
        } else {
          // No highlighted result: Tab/Shift+Tab cycle the modal's focusable controls
          trapFocus(event, !event.shiftKey)
        }
        break

      default:
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === shortcutKey.toLowerCase()) {
          event.preventDefault()
          event.stopPropagation()
          void close()
        }
        break
    }
  }

  function handleQueryChange(value: string) {
    if (value) setActiveSection(null)
    setQuery(value)
  }

  const handleToggleSection = (section: HomeSection) => {
    commandPanel.close()
    setActiveSection((previous) => (previous === section ? null : section))
    setQuery('')
    inputRef.current?.focus()
  }

  const handleTypeToggle = (type: string) => {
    const newTypes = selectedTypes.includes(type) ? selectedTypes.filter((t) => t !== type) : [...selectedTypes, type]
    if (newTypes.length > 0) {
      setSelectedTypes(newTypes)
    }
    setSelectedIndex(0)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      void close()
    }
  }

  const hasResults = visibleResults.length > 0 || Object.values(limitedSearchResults).some((arr) => arr.length > 0)
  const isCommandEmptyState = parsedCommand.isCommand && !parsedCommand.query && parsedCommand.command
  const showListbox =
    !showSettings &&
    hasSession &&
    !isLoading &&
    !searchError &&
    query.trim() !== '' &&
    !isCommandEmptyState &&
    hasResults
  const activeDescendantId = showListbox && visibleResults[selectedIndex] ? `ultraforce-option-${selectedIndex}` : null
  // Keep live announcements free of query text. / 实时播报不包含查询文本。
  const liveStatusText = showListbox
    ? t(visibleResults.length === 1 ? '1 result' : '{count} results', { count: visibleResults.length })
    : hasSession &&
        !isLoading &&
        !searchError &&
        query.trim() !== '' &&
        !hasResults &&
        !showCommandHints &&
        !extractedId &&
        !isCommandEmptyState
      ? t('No results')
      : ''

  if (!isVisible) return null

  return (
    <>
      <style>
        {getInterFontFaces()}
        {SEARCH_MODAL_STYLES}
      </style>
      <div className="ultraforce-backdrop" data-closing={closing || undefined} onClick={handleBackdropClick}>
        <div
          className="ultraforce-search-modal"
          data-ultraforce-modal
          data-ui-mode={hasText ? 'results' : 'idle'}
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          lang={browserLocale()}
          aria-modal="true"
          aria-label={t('UltraForce search')}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="search-surface">
            {!showSettings && (
              <div className="search-bar-row">
                <SearchInput
                  ref={inputRef}
                  query={query}
                  commands={allCommands}
                  scopeFilter={pickerOpen ? commandPanel.filter : undefined}
                  onQueryChange={pickerOpen ? commandPanel.changeFilter : handleQueryChange}
                  onKeyDown={(e) => {
                    if (['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                      handleKeyDown(e)
                    }
                  }}
                  sfHost={sfHost}
                  pageHasFocus={pageHasFocus}
                  expanded={pickerOpen || showListbox}
                  controlsId={pickerOpen ? COMMAND_LISTBOX_ID : RESULTS_LISTBOX_ID}
                  activeDescendantId={pickerOpen ? getCommandOptionId(commandPanel.selectedKey) : activeDescendantId}
                />
                <SearchBarActions
                  activeSection={activeSection}
                  hidden={hasText}
                  onToggleSection={handleToggleSection}
                  onSettings={() => {
                    commandPanel.close()
                    setShowSettings(true)
                  }}
                />
              </div>
            )}
            <AnimatedPanel
              view={showSettings ? 'settings' : pickerOpen ? 'picker' : 'search'}
              footer={<StorageWarning messages={storageWarnings} onDismiss={dismissStorageWarnings} />}
            >
              {showSettings ? (
                <SettingsPanel
                  onClose={() => setShowSettings(false)}
                  selectedTypes={selectedTypes}
                  onToggleType={handleTypeToggle}
                  shortcutKey={shortcutKey}
                  onShortcutChange={(key) => updateSettings({ shortcutKey: key })}
                  closeOnNavigate={closeOnNavigate}
                  onCloseOnNavigateChange={(val) => updateSettings({ closeOnNavigate: val })}
                  autoLoadFields={autoLoadFields}
                  onAutoLoadFieldsChange={(val) => updateSettings({ autoLoadFields: val })}
                  fuzzySearch={fuzzySearch}
                  onFuzzySearchChange={(val) => storeSetFuzzy(val)}
                  hideManagedPackage={hideManagedPackage}
                  onHideManagedPackageChange={(val) => updateSettings({ hideManagedPackage: val })}
                  maxResultsPerType={maxResultsPerType}
                  onMaxResultsPerTypeChange={(val) => updateSettings({ maxResultsPerType: val })}
                  managedKeys={managedKeys}
                  navigationMode={navigationMode}
                  onNavigationModeChange={(mode) => storeSetNavMode(mode)}
                  sfHost={sfHost}
                  customCommands={customCommands}
                  onCustomCommandsChange={setCustomCommands}
                />
              ) : pickerOpen ? (
                <CommandPanel
                  options={commandPanel.options}
                  selectedKey={commandPanel.selectedKey}
                  filter={commandPanel.filter}
                  onHighlight={commandPanel.highlight}
                  onChoose={commandPanel.choose}
                  onBack={commandPanel.close}
                />
              ) : (
                <>
                  <div className="search-container">
                    {showCommandHints && <CommandHints commands={matchingCommands} prefix={query} />}

                    {!hasSession && !activeSection ? (
                      <EmptyState type="no-session" />
                    ) : isLoading && !activeSection ? (
                      <EmptyState type="loading" />
                    ) : searchError && !activeSection ? (
                      <EmptyState type="error" errorMessage={searchError} />
                    ) : !query.trim() ? (
                      <>
                        {recordContext && recordActions.length > 0 && (
                          <RecordActions
                            actions={recordActions}
                            objectApiName={recordContext.objectApiName}
                            selectedIndex={selectedRecordActionIndex}
                          />
                        )}
                        <HomeScreen
                          onNavigate={handleHomeNavigate}
                          onToggleFavorite={handleToggleFavorite}
                          onRemoveHistoryItem={handleRemoveHistoryItem}
                          selectedTypes={selectedTypes}
                          section={activeSection ?? undefined}
                        />
                        {setupSuggestions.length > 0 && (
                          <div className="setup-suggestions">
                            <div className="setup-suggestions-header">{t('Related Setup Pages')}</div>
                            <div className="setup-suggestions-list">
                              {setupSuggestions.map((s) => (
                                <div
                                  key={s.id}
                                  className="setup-suggestion-item"
                                  onClick={() => onNavigate?.(sfHost ? `https://${sfHost}${s.path}` : s.path)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' && onNavigate?.(sfHost ? `https://${sfHost}${s.path}` : s.path)
                                  }
                                >
                                  <span className="setup-suggestion-name">{t(s.name)}</span>
                                  <span className="setup-suggestion-category">{t(s.description)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : parsedCommand.isCommand && !parsedCommand.query && parsedCommand.command ? (
                      <EmptyState
                        type="command"
                        commandTypes={parsedCommand.types || []}
                        commandDescription={
                          parsedCommand.command.isBuiltin
                            ? t(parsedCommand.command.description)
                            : parsedCommand.command.description
                        }
                      />
                    ) : !hasResults && extractedIds.length > 0 && sfHost ? (
                      <div className="id-preview-list">
                        {extractedIds.map((id) => (
                          <IdPreview key={id} recordId={id} sfHost={sfHost} onNavigate={() => onIdNavigate?.(id)} />
                        ))}
                      </div>
                    ) : !hasResults && extractedId ? (
                      <EmptyState type="id-navigation" query={extractedId} />
                    ) : !hasResults ? (
                      !showCommandHints && <EmptyState type="empty" query={query} />
                    ) : (
                      <SearchResults
                        results={limitedSearchResults}
                        selectedIndex={selectedIndex}
                        onResultClick={onResultClick}
                        onActionClick={onActionClick}
                        onVisibleCountChange={handleVisibleCountChange}
                        collapsedGroups={collapsedGroups}
                        onToggleCollapse={handleToggleCollapse}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={isFavoriteCheck}
                        listboxId={RESULTS_LISTBOX_ID}
                      />
                    )}
                  </div>

                  <SearchFooter
                    liveStatusText={liveStatusText}
                    canOpenScopes={commandPanel.canOpen}
                    resultsMode={hasText}
                  />
                </>
              )}
            </AnimatedPanel>
          </div>
          {!showSettings && showUpdateNotification && (
            <UpdateNotification
              version={updateVersion}
              releaseNotesUrl={RELEASE_NOTES_URL}
              onDismiss={handleDismissUpdate}
            />
          )}
        </div>
      </div>
    </>
  )
}

export default SearchModal
