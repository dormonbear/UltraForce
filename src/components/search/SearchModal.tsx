import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { SearchResult } from '~types'
import { isCustomCommand } from '~types'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import SettingsPanel from './SettingsPanel'
import EmptyState from './EmptyState'
import HomeScreen from './HomeScreen'
import IdPreview from './IdPreview'
import CommandHints from './CommandHints'
import UpdateNotification from './UpdateNotification'
import { SEARCH_MODAL_STYLES } from './styles'
import { getInterFontFaces } from '~lib/font-loader'
import { parseCommand, getMatchingCommands, mergeCommands, getCommandPrefix } from '~lib/command-parser'
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
import type { ObjectAction } from './ResultItem'

const MODAL_INLINE_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)'
}

const ACTION_ICON_PROPS = { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }

function renderActionIcon(icon: string): React.ReactNode {
  switch (icon) {
    case 'layout':
      return <svg {...ACTION_ICON_PROPS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    case 'type':
      return <svg {...ACTION_ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    case 'sharing':
      return <svg {...ACTION_ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'history':
      return <svg {...ACTION_ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    case 'related':
      return <svg {...ACTION_ICON_PROPS}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    case 'clone':
      return <svg {...ACTION_ICON_PROPS}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    case 'setup':
      return <svg {...ACTION_ICON_PROPS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    default:
      return <svg {...ACTION_ICON_PROPS}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
  }
}

interface SearchModalProps {
  onClose: () => void
  onSearch: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onCustomSearch?: (soqlTemplate: string, query: string, useToolingApi: boolean, nameField: string, descriptionFields?: string[]) => void
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

  // --- HomeScreen integration ---
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const isFavoriteCheck = useFavoritesStore((s) => s.isFavorite)
  const removeHistoryItem = useHistoryStore((s) => s.removeItem)

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
        onClose()
      }
    },
    [onNavigate, closeOnNavigate, onClose]
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
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [_visibleItemCount, setVisibleItemCount] = useState(0)
  const [showCommandHints, setShowCommandHints] = useState(false)
  const [unsupportedTypes, setUnsupportedTypes] = useState<string[]>([])
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Refs to avoid re-triggering useEffect on callback changes
  const onSearchRef = React.useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  // Load unsupported types for current org
  useEffect(() => {
    if (sfHost) {
      getUnsupportedTypes(sfHost).then(setUnsupportedTypes).catch(() => {})
    }
  }, [sfHost])

  // Check for version updates (only on first mount)
  const hasCheckedUpdate = useRef(false)
  useEffect(() => {
    if (isVisible && !hasCheckedUpdate.current) {
      hasCheckedUpdate.current = true
      checkForUpdate().then(({ hasUpdate, currentVersion }) => {
        if (hasUpdate) {
          setShowUpdateNotification(true)
          setUpdateVersion(currentVersion)
          markNotificationAsShown().catch(() => {})
        }
      }).catch(() => {})
    }
  }, [isVisible])

  // Merge builtin and custom commands
  const allCommands = useMemo(() => mergeCommands(customCommands), [customCommands])

  // Parse command from query
  const parsedCommand = useMemo(() => parseCommand(query, allCommands), [query, allCommands])
  const matchingCommands = useMemo(() => getMatchingCommands(query, allCommands, unsupportedTypes), [query, allCommands, unsupportedTypes])
  const extractedId = useMemo(() => extractSalesforceId(query.trim()), [query])
  const extractedIds = useMemo(() => extractAllSalesforceIds(query.trim()), [query])
  const setupSuggestions = useMemo(
    () => isSetupPage(window.location.pathname)
      ? getSetupSuggestions(window.location.pathname, SETUP_SHORTCUTS)
      : [],
    []
  )

  // Show/hide command hints
  useEffect(() => {
    const shouldShow = query === ':' && matchingCommands.length > 0
    setShowCommandHints(shouldShow)
  }, [query, matchingCommands.length])

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
        onCustomSearchRef.current?.(customCmd.soql, searchQuery, customCmd.useToolingApi, customCmd.nameField, customCmd.descriptionFields)
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
  }, [query, parsedCommand, selectedTypes, hasSession, fuzzySearch, hideManagedPackage, settingsReady])

  // Reset selection and collapsed state when search results change
  useEffect(() => {
    setSelectedIndex(0)
    setCollapsedGroups({})
  }, [searchResults])

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
    setCollapsedGroups(prev => {
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
    const actions: { id: string; name: string; handler: () => void; icon: string; description?: string }[] = []
    if (onPageLayoutClick) {
      actions.push({ id: 'page-layout', name: 'Page Layout', handler: onPageLayoutClick, icon: 'layout' })
    }
    if (recordContext.recordTypeId && onRecordTypeClick) {
      actions.push({ id: 'record-type', name: 'Record Type', handler: onRecordTypeClick, icon: 'type' })
    }
    if (onFieldsClick) {
      actions.push({ id: 'fields', name: 'Fields', handler: onFieldsClick, icon: 'fields' })
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // When query is empty and we have record actions, handle navigation for record actions
    const isInRecordActionsMode = !query.trim() && recordActions.length > 0 && hasSession && !isLoading

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        if (showSettings) {
          setShowSettings(false)
        } else {
          onClose()
        }
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
        event.preventDefault()
        if (visibleResults[selectedIndex]) {
          const selectedResult = visibleResults[selectedIndex]
          const prefix = getCommandPrefix(parsedCommand)
          if (selectedResult.type === 'CustomObject') {
            const objectApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
            setQuery(`${prefix}${objectApiName}.`)
          } else if (selectedResult.type === 'CustomField') {
            const objectApiName = selectedResult.metadata?.ObjectApiName || selectedResult.metadata?.EntityDefinition?.QualifiedApiName
            const fieldApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
            if (objectApiName) {
              setQuery(`${prefix}${objectApiName}.${fieldApiName}`)
            }
          } else if (selectedResult.type === 'CustomMetadataType') {
            if (selectedResult.metadata?._isTypeDefinition) {
              const cmdtApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${prefix}${cmdtApiName}.`)
            } else {
              const parentType = selectedResult.metadata?._parentType
              const recordName = selectedResult.metadata?.DeveloperName || selectedResult.name
              if (parentType) {
                setQuery(`${prefix}${parentType}.${recordName}`)
              }
            }
          } else if (selectedResult.type === 'CustomSetting') {
            if (selectedResult.metadata?._isSettingDefinition) {
              const settingApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${prefix}${settingApiName}.`)
            } else {
              const parentType = selectedResult.metadata?._parentType
              const recordName = selectedResult.metadata?.Name || selectedResult.name
              if (parentType) {
                setQuery(`${prefix}${parentType}.${recordName}`)
              }
            }
          } else if (selectedResult.type === 'Profile') {
            const profileName = selectedResult.name
            setQuery(`${prefix}${profileName}.`)
          } else if (selectedResult.type === 'ProfileSubMenu') {
            const { profileName, subCategory } = selectedResult.metadata || {}
            if (profileName && subCategory) {
              setQuery(`${prefix}${profileName}.${subCategory}.`)
            }
          } else if (
            selectedResult.type === 'ObjectPermission' ||
            selectedResult.type === 'FieldPermission' ||
            selectedResult.type === 'CustomPermissionAccess' ||
            selectedResult.type === 'ApexClassAccess' ||
            selectedResult.type === 'VFPageAccess' ||
            selectedResult.type === 'ConnectedAppAccess' ||
            selectedResult.type === 'AssignedAppAccess'
          ) {
            const { profileName, _subCategory } = selectedResult.metadata || {}
            if (profileName && _subCategory) {
              setQuery(`${prefix}${profileName}.${_subCategory}.${selectedResult.name}`)
            }
          } else if (selectedResult.type === 'ProfileSetupLink') {
            // Navigate-only link: Enter navigates, Tab does nothing special
          }
        }
        break

      default:
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === shortcutKey.toLowerCase()
        ) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
        break
    }
  }

  const handleTypeToggle = (type: string) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type]
    if (newTypes.length > 0) {
      setSelectedTypes(newTypes)
    }
    setSelectedIndex(0)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isVisible) return null

  const hasResults = visibleResults.length > 0 || Object.values(limitedSearchResults).some(arr => arr.length > 0)

  return (
    <>
      <style>{getInterFontFaces()}{SEARCH_MODAL_STYLES}</style>
      <div className="ultraforce-backdrop" onClick={handleBackdropClick}>
        <div
          className="ultraforce-search-modal"
          data-ultraforce-modal
          ref={modalRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={MODAL_INLINE_STYLE}
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
            navigationMode={navigationMode}
            onNavigationModeChange={(mode) => storeSetNavMode(mode)}
            sfHost={sfHost}
            customCommands={customCommands}
            onCustomCommandsChange={setCustomCommands}
          />
        ) : (
          <>
            <div className="search-container">
              <SearchInput
                ref={inputRef}
                query={query}
                onQueryChange={setQuery}
                onKeyDown={(e) => {
                  if (['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                    handleKeyDown(e)
                  }
                }}
                sfHost={sfHost}
              />

              {showCommandHints && (
                <CommandHints commands={matchingCommands} />
              )}

              {!hasSession ? (
                <EmptyState type="no-session" />
              ) : isLoading ? (
                <EmptyState type="loading" />
              ) : searchError ? (
                <EmptyState
                  type="error"
                  errorMessage={searchError}
                />
              ) : !query.trim() ? (
                <>
                  {recordContext && recordActions.length > 0 && (
                    <div className="record-actions">
                      <div className="record-actions-header">
                        Record Actions
                        {recordContext.objectApiName && (
                          <span className="record-object-name">{recordContext.objectApiName}</span>
                        )}
                      </div>
                      <div className="record-actions-list">
                      {recordActions.map((action, index) => (
                        <div
                          key={action.id}
                          className={`record-action-item${selectedRecordActionIndex === index ? ' selected' : ''}`}
                          onClick={action.handler}
                          role="button"
                          tabIndex={0}
                          title={action.name}
                          onKeyDown={(e) => e.key === 'Enter' && action.handler()}
                        >
                          <span className="record-action-icon">
                            {renderActionIcon(action.icon)}
                          </span>
                          <span className="record-action-text">{action.name}</span>
                          <span className="record-action-desc">
                            {action.description ?? action.name}
                          </span>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}
                  <HomeScreen
                    onNavigate={handleHomeNavigate}
                    onToggleFavorite={handleToggleFavorite}
                    onRemoveHistoryItem={handleRemoveHistoryItem}
                    selectedTypes={selectedTypes}
                  />
                  {setupSuggestions.length > 0 && (
                    <div className="setup-suggestions">
                      <div className="setup-suggestions-header">Related Setup Pages</div>
                      <div className="setup-suggestions-list">
                        {setupSuggestions.map((s) => (
                          <div
                            key={s.id}
                            className="setup-suggestion-item"
                            onClick={() => onNavigate?.(sfHost ? `https://${sfHost}${s.path}` : s.path)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && onNavigate?.(sfHost ? `https://${sfHost}${s.path}` : s.path)}
                          >
                            <span className="setup-suggestion-name">{s.name}</span>
                            <span className="setup-suggestion-category">{s.description}</span>
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
                  commandDescription={parsedCommand.command.description}
                />
              ) : !hasResults && extractedIds.length > 0 && sfHost ? (
                <div className="id-preview-list">
                  {extractedIds.map((id) => (
                    <IdPreview
                      key={id}
                      recordId={id}
                      sfHost={sfHost}
                      onNavigate={() => onIdNavigate?.(id)}
                    />
                  ))}
                </div>
              ) : !hasResults && extractedId ? (
                <EmptyState type="id-navigation" query={extractedId} />
              ) : !hasResults ? (
                <EmptyState type="empty" query={query} />
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
                />
              )}
            </div>

            <div className="search-footer">
              <div className="shortcuts">
                <div className="shortcut-item">
                  <kbd>Up/Down</kbd> Navigate
                </div>
                <div className="shortcut-item">
                  <kbd>Tab</kbd> Autocomplete
                </div>
                <div className="shortcut-item">
                  <kbd>Enter</kbd> Open
                </div>
                <div className="shortcut-item">
                  <kbd>Esc</kbd> Close
                </div>
              </div>

              <button
                className="settings-button"
                data-ultraforce-settings-button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowSettings(true)
                }}
                title="Settings"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>

            {showUpdateNotification && (
              <UpdateNotification
                version={updateVersion}
                releaseNotesUrl={RELEASE_NOTES_URL}
                onDismiss={handleDismissUpdate}
              />
            )}
          </>
        )}
        </div>
      </div>
    </>
  )
}

export default SearchModal
