import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { SearchResult, SearchCommand } from '~types'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import SettingsPanel, { type NavigationMode } from './SettingsPanel'
import EmptyState from './EmptyState'
import CommandHints from './CommandHints'
import { SEARCH_MODAL_STYLES } from './styles'
import { parseCommand, getMatchingCommands, DEFAULT_COMMANDS } from '~lib/command-parser'

import type { ObjectAction } from './ResultItem'

interface SearchModalProps {
  isVisible: boolean
  onClose: () => void
  onSearch: (query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean) => void
  onResultClick: (result: SearchResult) => void
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
}

const SearchModal: React.FC<SearchModalProps> = ({
  isVisible,
  onClose,
  onSearch,
  onResultClick,
  onActionClick,
  onClearResults,
  searchResults,
  isLoading,
  sfHost,
  hasSession,
  navigationMode: externalNavMode,
  onNavigationModeChange,
  fuzzySearch: externalFuzzySearch,
  onFuzzySearchChange
}) => {
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ApexClass'])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [shortcutKey, setShortcutKey] = useState<string>('b')
  const [closeOnNavigate, setCloseOnNavigate] = useState<boolean>(true)
  const [autoLoadFields, setAutoLoadFields] = useState<boolean>(true)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(externalNavMode || 'auto')
  const [fuzzySearch, setFuzzySearch] = useState<boolean>(externalFuzzySearch ?? true)
  const [hideManagedPackage, setHideManagedPackage] = useState<boolean>(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [visibleItemCount, setVisibleItemCount] = useState(0)
  const [commands, setCommands] = useState<Record<string, SearchCommand>>(DEFAULT_COMMANDS)
  const [showCommandHints, setShowCommandHints] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(['ultraforce_search_settings'])
        if (result.ultraforce_search_settings?.selectedTypes) {
          setSelectedTypes(result.ultraforce_search_settings.selectedTypes)
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
        if (result.ultraforce_search_settings?.commands) {
          setCommands(result.ultraforce_search_settings.commands)
        }
        setSettingsLoaded(true)
      } catch (error) {
        console.error('Failed to load settings:', error)
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [])

  // Save settings
  useEffect(() => {
    if (!settingsLoaded) return

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
          commands,
          lastUpdated: Date.now()
        }
        await chrome.storage.local.set({ ultraforce_search_settings: settings })
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }

    saveSettings()
  }, [selectedTypes, shortcutKey, closeOnNavigate, autoLoadFields, navigationMode, fuzzySearch, hideManagedPackage, commands, settingsLoaded])

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

  // Debounced search - use useRef to avoid re-triggering on onSearch change
  const onSearchRef = React.useRef(onSearch)
  onSearchRef.current = onSearch

  // Parse command from query
  const parsedCommand = useMemo(() => parseCommand(query, commands), [query, commands])
  const matchingCommands = useMemo(() => getMatchingCommands(query, commands), [query, commands])

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

  useEffect(() => {
    const searchQuery = parsedCommand.isCommand ? parsedCommand.query : query
    const searchTypes = parsedCommand.types || selectedTypes

    if (!searchQuery.trim() || searchTypes.length === 0 || !hasSession) {
      return
    }

    const debounceTimer = setTimeout(() => {
      onSearchRef.current(searchQuery, searchTypes, fuzzySearch, hideManagedPackage)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [query, parsedCommand, selectedTypes, hasSession, fuzzySearch, hideManagedPackage])

  // Reset selection and collapsed state when search results change
  useEffect(() => {
    setSelectedIndex(0)
    setCollapsedGroups({})
  }, [searchResults])

  const visibleResults = useMemo(() => {
    const items: SearchResult[] = []
    Object.entries(searchResults).forEach(([type, typeResults]) => {
      if (typeResults.length === 0) return
      if (!collapsedGroups[type]) {
        items.push(...typeResults)
      }
    })
    return items
  }, [searchResults, collapsedGroups])

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

  const handleKeyDown = (event: React.KeyboardEvent) => {
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
        setSelectedIndex((prev) => Math.min(prev + 1, visibleResults.length - 1))
        break

      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break

      case 'Enter':
        event.preventDefault()
        if (visibleResults[selectedIndex]) {
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
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
    setSelectedIndex(0)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isVisible) return null

  const hasResults = visibleResults.length > 0 || Object.values(searchResults).some(arr => arr.length > 0)

  return (
    <>
      <style>{SEARCH_MODAL_STYLES}</style>
      <div className="ultraforce-backdrop" onClick={handleBackdropClick}>
        <div
          className="ultraforce-search-modal"
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
            navigationMode={navigationMode}
            onNavigationModeChange={handleNavigationModeChange}
            sfHost={sfHost}
            commands={commands}
            onCommandsChange={setCommands}
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
              ) : !query.trim() ? (
                <EmptyState type="start" selectedTypes={selectedTypes} />
              ) : parsedCommand.isCommand && !parsedCommand.query && parsedCommand.types ? (
                <EmptyState type="command" commandTypes={parsedCommand.types} />
              ) : !hasResults ? (
                <EmptyState type="empty" query={query} />
              ) : (
                <SearchResults
                  results={searchResults}
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
          </>
        )}
        </div>
      </div>
    </>
  )
}

export default SearchModal
