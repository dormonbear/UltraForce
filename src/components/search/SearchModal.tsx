import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { SearchResult, CustomCommand } from '~types'
import { isCustomCommand } from '~types'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import SettingsPanel, { type NavigationMode } from './SettingsPanel'
import EmptyState from './EmptyState'
import CommandHints from './CommandHints'
import UpdateNotification from './UpdateNotification'
import { SEARCH_MODAL_STYLES } from './styles'
import { parseCommand, getMatchingCommands, mergeCommands } from '~lib/command-parser'
import { getUnsupportedTypes } from '~lib/salesforce-api'
import { checkForUpdate, markNotificationAsShown, RELEASE_NOTES_URL } from '~lib/version-check'
import { logger } from '~lib/logger'
import type { ObjectAction } from './ResultItem'

// Salesforce ID validation: 15 or 18 alphanumeric characters
function isSalesforceId(str: string): boolean {
  const trimmed = str.trim()
  return /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(trimmed)
}

interface RecordContext {
  objectApiName: string | null
  recordId: string
  recordTypeId?: string | null
}

interface SearchModalProps {
  isVisible: boolean
  onClose: () => void
  onSearch: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onCustomSearch?: (soqlTemplate: string, query: string, useToolingApi: boolean, nameField: string, descriptionFields?: string[]) => void
  onSetupSearch?: (query: string) => void
  onResultClick: (result: SearchResult) => void
  onIdNavigate?: (id: string) => void
  onActionClick?: (result: SearchResult, action: ObjectAction) => void
  onClearResults?: () => void
  searchResults: Record<string, SearchResult[]>
  isLoading: boolean
  sfHost: string | null
  hasSession: boolean
  navigationMode?: NavigationMode
  onNavigationModeChange?: (mode: NavigationMode) => void
  fuzzySearch?: boolean
  onFuzzySearchChange?: (value: boolean) => void
  searchError?: string | null
  recordContext?: RecordContext | null
  onPageLayoutClick?: () => void
  onRecordTypeClick?: () => void
  onFieldsClick?: () => void
}

const SearchModal: React.FC<SearchModalProps> = ({
  isVisible,
  onClose,
  onSearch,
  onCustomSearch,
  onSetupSearch,
  onResultClick,
  onIdNavigate,
  onActionClick,
  onClearResults,
  searchResults,
  isLoading,
  sfHost,
  hasSession,
  navigationMode: externalNavMode,
  onNavigationModeChange,
  fuzzySearch: externalFuzzySearch,
  onFuzzySearchChange,
  searchError,
  recordContext,
  onPageLayoutClick,
  onRecordTypeClick,
  onFieldsClick
}) => {
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CustomObject', 'CustomField'])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [shortcutKey, setShortcutKey] = useState<string>('b')
  const [closeOnNavigate, setCloseOnNavigate] = useState<boolean>(true)
  const [autoLoadFields, setAutoLoadFields] = useState<boolean>(true)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(externalNavMode || 'auto')
  const [fuzzySearch, setFuzzySearch] = useState<boolean>(externalFuzzySearch ?? true)
  const [hideManagedPackage, setHideManagedPackage] = useState<boolean>(true)
  const [maxResultsPerType, setMaxResultsPerType] = useState<number>(50)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [_visibleItemCount, setVisibleItemCount] = useState(0)
  const [customCommands, setCustomCommands] = useState<Record<string, CustomCommand>>({})
  const [showCommandHints, setShowCommandHints] = useState(false)
  const [unsupportedTypes, setUnsupportedTypes] = useState<string[]>([])
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const isInitialMount = useRef(true)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(['ultraforce_search_settings'])
        if (result.ultraforce_search_settings?.selectedTypes) {
          // Clean up orphan types that don't belong to complete groups
          const validGroups = [
            ['ApexClass', 'ApexTrigger'],
            ['ApexPage', 'ApexComponent'],
            ['AuraDefinitionBundle', 'LightningComponentBundle'],
            ['CustomObject', 'CustomField'],
            ['Flow'],
            ['CustomLabel'],
            ['CustomMetadataType'],
            ['CustomSetting'],
            ['PermissionSet'],
            ['Profile']
          ]
          const loadedTypes = result.ultraforce_search_settings.selectedTypes as string[]
          const cleanedTypes = loadedTypes.filter((type) => {
            const group = validGroups.find((g) => g.includes(type))
            if (!group) return false
            // For single-item groups, always valid
            if (group.length === 1) return true
            // For multi-item groups, all items must be present
            return group.every((t) => loadedTypes.includes(t))
          })
          setSelectedTypes(cleanedTypes.length > 0 ? cleanedTypes : ['CustomObject', 'CustomField'])
        }
        if (result.ultraforce_search_settings?.shortcutKey) {
          setShortcutKey(result.ultraforce_search_settings.shortcutKey)
        }
        if (result.ultraforce_search_settings?.closeOnNavigate !== undefined) {
          setCloseOnNavigate(result.ultraforce_search_settings.closeOnNavigate)
        }
        if (result.ultraforce_search_settings?.autoLoadFields !== undefined) {
          setAutoLoadFields(result.ultraforce_search_settings.autoLoadFields)
        }
        if (result.ultraforce_search_settings?.navigationMode) {
          setNavigationMode(result.ultraforce_search_settings.navigationMode)
        }
        if (result.ultraforce_search_settings?.fuzzySearch !== undefined) {
          setFuzzySearch(result.ultraforce_search_settings.fuzzySearch)
        }
        if (result.ultraforce_search_settings?.hideManagedPackage !== undefined) {
          setHideManagedPackage(result.ultraforce_search_settings.hideManagedPackage)
        }
        if (result.ultraforce_search_settings?.maxResultsPerType !== undefined) {
          setMaxResultsPerType(result.ultraforce_search_settings.maxResultsPerType)
        }
        if (result.ultraforce_search_settings?.customCommands) {
          setCustomCommands(result.ultraforce_search_settings.customCommands)
        }
        setSettingsLoaded(true)
      } catch (error) {
        logger.error('settings:load:failed', error)
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [])

  // Save settings (skip initial mount to avoid overwriting loaded settings)
  useEffect(() => {
    if (!settingsLoaded) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const saveSettings = async () => {
      try {
        const settings = {
          selectedTypes,
          shortcutKey,
          closeOnNavigate,
          autoLoadFields,
          navigationMode,
          fuzzySearch,
          hideManagedPackage,
          maxResultsPerType,
          customCommands,
          lastUpdated: Date.now()
        }
        await chrome.storage.local.set({ ultraforce_search_settings: settings })
      } catch (error) {
        logger.error('settings:save:failed', error)
      }
    }

    saveSettings()
  }, [selectedTypes, shortcutKey, closeOnNavigate, autoLoadFields, navigationMode, fuzzySearch, hideManagedPackage, maxResultsPerType, customCommands, settingsLoaded])

  // Notify parent when navigationMode changes
  const handleNavigationModeChange = (mode: NavigationMode) => {
    setNavigationMode(mode)
    onNavigationModeChange?.(mode)
  }

  // Notify parent when fuzzySearch changes
  const handleFuzzySearchChange = (value: boolean) => {
    setFuzzySearch(value)
    onFuzzySearchChange?.(value)
  }

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
        onClearResults?.()
      }
    }
  }, [parsedCommand.isCommand, parsedCommand.commandKey, onClearResults])

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

    // Wait for settings to be loaded before normal search (to respect user's selected types)
    if (!settingsLoaded) {
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
  }, [query, parsedCommand, selectedTypes, hasSession, fuzzySearch, hideManagedPackage, settingsLoaded])

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
    const actions: { id: string; name: string; handler: () => void; icon: string }[] = []
    if (onPageLayoutClick) {
      actions.push({ id: 'page-layout', name: 'Page Layout', handler: onPageLayoutClick, icon: 'layout' })
    }
    if (recordContext.recordTypeId && onRecordTypeClick) {
      actions.push({ id: 'record-type', name: 'Record Type', handler: onRecordTypeClick, icon: 'type' })
    }
    if (onFieldsClick) {
      actions.push({ id: 'fields', name: 'Fields', handler: onFieldsClick, icon: 'fields' })
    }
    return actions
  }, [recordContext, onPageLayoutClick, onRecordTypeClick, onFieldsClick])

  // Track selected record action index (separate from search results)
  const [selectedRecordActionIndex, setSelectedRecordActionIndex] = useState(0)

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
        } else if (isSalesforceId(query) && onIdNavigate) {
          // Check if query is a Salesforce ID - navigate directly
          onIdNavigate(query.trim())
        } else if (visibleResults[selectedIndex]) {
          onResultClick(visibleResults[selectedIndex])
        }
        break

      case 'Tab':
        event.preventDefault()
        if (visibleResults[selectedIndex]) {
          const selectedResult = visibleResults[selectedIndex]
          if (selectedResult.type === 'CustomObject') {
            const objectApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
            setQuery(`${objectApiName}.`)
          } else if (selectedResult.type === 'CustomField') {
            const objectApiName = selectedResult.metadata?.ObjectApiName || selectedResult.metadata?.EntityDefinition?.QualifiedApiName
            const fieldApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
            if (objectApiName) {
              setQuery(`${objectApiName}.${fieldApiName}`)
            }
          } else if (selectedResult.type === 'CustomMetadataType') {
            if (selectedResult.metadata?._isTypeDefinition) {
              // Type definition: autocomplete to "Type__mdt." to search records
              const cmdtApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${cmdtApiName}.`)
            } else {
              // Record: autocomplete to "ParentType__mdt.RecordName"
              const parentType = selectedResult.metadata?._parentType
              const recordName = selectedResult.metadata?.DeveloperName || selectedResult.name
              if (parentType) {
                setQuery(`${parentType}.${recordName}`)
              }
            }
          } else if (selectedResult.type === 'CustomSetting') {
            if (selectedResult.metadata?._isSettingDefinition) {
              // Setting definition: autocomplete to "Setting__c." to search records
              const settingApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${settingApiName}.`)
            } else {
              // Record: autocomplete to "ParentSetting__c.RecordName"
              const parentType = selectedResult.metadata?._parentType
              const recordName = selectedResult.metadata?.Name || selectedResult.name
              if (parentType) {
                setQuery(`${parentType}.${recordName}`)
              }
            }
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
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        const newTypes = prev.filter((t) => t !== type)
        // Prevent removing all types - keep at least one
        return newTypes.length > 0 ? newTypes : prev
      }
      return [...prev, type]
    })
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
      <style>{SEARCH_MODAL_STYLES}</style>
      <div className="ultraforce-backdrop" onClick={handleBackdropClick}>
        <div
          className="ultraforce-search-modal"
          data-ultraforce-modal
          ref={modalRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        >
        {showSettings ? (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            selectedTypes={selectedTypes}
            onToggleType={handleTypeToggle}
            shortcutKey={shortcutKey}
            onShortcutChange={setShortcutKey}
            closeOnNavigate={closeOnNavigate}
            onCloseOnNavigateChange={setCloseOnNavigate}
            autoLoadFields={autoLoadFields}
            onAutoLoadFieldsChange={setAutoLoadFields}
            fuzzySearch={fuzzySearch}
            onFuzzySearchChange={handleFuzzySearchChange}
            hideManagedPackage={hideManagedPackage}
            onHideManagedPackageChange={setHideManagedPackage}
            maxResultsPerType={maxResultsPerType}
            onMaxResultsPerTypeChange={setMaxResultsPerType}
            navigationMode={navigationMode}
            onNavigationModeChange={handleNavigationModeChange}
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
                  e.stopPropagation()
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
                      {recordActions.map((action, index) => (
                        <div
                          key={action.id}
                          className={`record-action-item${selectedRecordActionIndex === index ? ' selected' : ''}`}
                          onClick={action.handler}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && action.handler()}
                        >
                          <span className="record-action-icon">
                            {action.icon === 'layout' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="3" y1="9" x2="21" y2="9"/>
                                <line x1="9" y1="21" x2="9" y2="9"/>
                              </svg>
                            ) : action.icon === 'type' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="8" y1="6" x2="21" y2="6"/>
                                <line x1="8" y1="12" x2="21" y2="12"/>
                                <line x1="8" y1="18" x2="21" y2="18"/>
                                <line x1="3" y1="6" x2="3.01" y2="6"/>
                                <line x1="3" y1="12" x2="3.01" y2="12"/>
                                <line x1="3" y1="18" x2="3.01" y2="18"/>
                              </svg>
                            )}
                          </span>
                          <span className="record-action-text">{action.name}</span>
                          <span className="record-action-desc">
                            {action.icon === 'layout' ? 'Open page layout' : action.icon === 'type' ? 'Open record type' : 'Open fields list'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <EmptyState type="start" selectedTypes={selectedTypes} />
                </>
              ) : parsedCommand.isCommand && !parsedCommand.query && parsedCommand.command ? (
                <EmptyState
                  type="command"
                  commandTypes={parsedCommand.types || []}
                  commandDescription={parsedCommand.command.description}
                />
              ) : !hasResults && isSalesforceId(query) ? (
                <EmptyState type="id-navigation" query={query.trim()} />
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
