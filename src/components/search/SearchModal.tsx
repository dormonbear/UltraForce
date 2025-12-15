import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { SearchResult, CustomCommand } from '~types'
import type { SOQLSuggestion, SOQLQueryResult, ExportFormat } from '~types/soql'
import { isCustomCommand } from '~types'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import SettingsPanel, { type NavigationMode } from './SettingsPanel'
import EmptyState from './EmptyState'
import CommandHints from './CommandHints'
import { SEARCH_MODAL_STYLES } from './styles'
import { parseCommand, getMatchingCommands, mergeCommands, BUILTIN_COMMANDS } from '~lib/command-parser'
import { getSOQLSuggestions, applySuggestion, executeSOQLQuery, exportResults, copyToClipboard } from '~lib/soql-helper'
import { logger } from '~lib/logger'

import type { ObjectAction } from './ResultItem'

// Salesforce ID validation: 15 or 18 alphanumeric characters
function isSalesforceId(str: string): boolean {
  const trimmed = str.trim()
  return /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(trimmed)
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
  searchError
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
  const [visibleItemCount, setVisibleItemCount] = useState(0)
  const [customCommands, setCustomCommands] = useState<Record<string, CustomCommand>>({})
  const [showCommandHints, setShowCommandHints] = useState(false)

  // SOQL state
  const [soqlSuggestions, setSoqlSuggestions] = useState<SOQLSuggestion[]>([])
  const [soqlSelectedIndex, setSoqlSelectedIndex] = useState(0)
  const [soqlResult, setSoqlResult] = useState<SOQLQueryResult | null>(null)
  const [soqlError, setSoqlError] = useState<string | null>(null)
  const [soqlLoading, setSoqlLoading] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [soqlCursorPos, setSoqlCursorPos] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const soqlSuggestionsRef = useRef<HTMLDivElement>(null)
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

  // Debounced search - use useRef to avoid re-triggering on onSearch change
  const onSearchRef = React.useRef(onSearch)
  onSearchRef.current = onSearch

  // Merge builtin and custom commands
  const allCommands = useMemo(() => mergeCommands(customCommands), [customCommands])

  // Parse command from query
  const parsedCommand = useMemo(() => parseCommand(query, allCommands), [query, allCommands])
  const matchingCommands = useMemo(() => getMatchingCommands(query, allCommands), [query, allCommands])

  // Check if SOQL mode
  const isSOQLMode = parsedCommand.isCommand && parsedCommand.command?.key === 's'
  const soqlStartIndex = useMemo(() => {
    if (!isSOQLMode) return null
    const match = query.match(/^\s*:\s*s\s+/i)
    return match ? match[0].length : null
  }, [isSOQLMode, query])

  const soqlQuery = useMemo(() => {
    if (!isSOQLMode || soqlStartIndex === null) return ''
    return query.slice(soqlStartIndex)
  }, [isSOQLMode, query, soqlStartIndex])

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
        // Reset SOQL state when switching commands
        setSoqlSuggestions([])
        setSoqlResult(null)
        setSoqlError(null)
      }
    }
  }, [parsedCommand.isCommand, parsedCommand.commandKey, onClearResults])

  // Ref for custom search callback
  const onCustomSearchRef = React.useRef(onCustomSearch)
  onCustomSearchRef.current = onCustomSearch

  // Ref for setup shortcut search callback
  const onSetupSearchRef = React.useRef(onSetupSearch)
  onSetupSearchRef.current = onSetupSearch

  // Fetch SOQL suggestions based on cursor position
  useEffect(() => {
    if (!isSOQLMode || !sfHost || !soqlQuery) {
      setSoqlSuggestions([])
      return
    }

    // Use actual cursor position within the SOQL query
    const cursorPos = Math.min(soqlCursorPos, soqlQuery.length)
    const timer = setTimeout(async () => {
      try {
        const suggestions = await getSOQLSuggestions(sfHost, soqlQuery, cursorPos, fuzzySearch)
        setSoqlSuggestions(suggestions)
        setSoqlSelectedIndex(0)
      } catch {
        setSoqlSuggestions([])
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [isSOQLMode, sfHost, soqlQuery, soqlCursorPos])

  // Keep the selected SOQL suggestion visible when navigating via keyboard
  useEffect(() => {
    if (!isSOQLMode || soqlSuggestions.length === 0) return
    const container = soqlSuggestionsRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-soql-index="${soqlSelectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [isSOQLMode, soqlSuggestions.length, soqlSelectedIndex])

  useEffect(() => {
    const searchQuery = parsedCommand.isCommand ? parsedCommand.query : query
    const isSetupCommand = parsedCommand.isCommand && parsedCommand.command?.key === 'g'

    // Setup shortcuts command (local, no API) - allow empty query and no session check
    if (isSetupCommand) {
      onSetupSearchRef.current?.(searchQuery)
      return
    }

    // SOQL mode is handled separately
    if (isSOQLMode) {
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
  }, [query, parsedCommand, selectedTypes, hasSession, fuzzySearch, hideManagedPackage, isSOQLMode, settingsLoaded])

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

  // Execute SOQL query
  const executeQuery = useCallback(async () => {
    if (!sfHost || !soqlQuery.trim()) return

    setSoqlLoading(true)
    setSoqlError(null)
    setSoqlResult(null)

    try {
      const result = await executeSOQLQuery(sfHost, soqlQuery)
      setSoqlResult(result)
      setSoqlSuggestions([])
    } catch (err: any) {
      setSoqlError(err.message || 'Query execution failed')
    } finally {
      setSoqlLoading(false)
    }
  }, [sfHost, soqlQuery])

  // Handle export
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!soqlResult?.records?.length) return

    const content = exportResults(soqlResult.records, format)
    const success = await copyToClipboard(content)

    if (success) {
      setExportMessage(`Copied as ${format.toUpperCase()}`)
      setTimeout(() => setExportMessage(null), 2000)
    }
  }, [soqlResult])

  // Apply SOQL suggestion at current cursor position
  const applySoqlSuggestion = useCallback((suggestion: SOQLSuggestion) => {
    const cursorPos = Math.min(soqlCursorPos, soqlQuery.length)
    const { newQuery, newCursorPos } = applySuggestion(soqlQuery, cursorPos, suggestion)
    setQuery(`:s ${newQuery}`)
    setSoqlSuggestions([])

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const fullPos = 3 + newCursorPos // ":s " prefix
        inputRef.current.setSelectionRange(fullPos, fullPos)
        setSoqlCursorPos(newCursorPos)
      }
    }, 0)
  }, [soqlQuery, soqlCursorPos])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // SOQL mode key handling
    if (isSOQLMode) {
      if (soqlSuggestions.length > 0) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            setSoqlSelectedIndex(prev => Math.min(prev + 1, soqlSuggestions.length - 1))
            return
          case 'ArrowUp':
            event.preventDefault()
            setSoqlSelectedIndex(prev => Math.max(prev - 1, 0))
            return
          case 'Tab':
            event.preventDefault()
            if (soqlSuggestions[soqlSelectedIndex]) {
              applySoqlSuggestion(soqlSuggestions[soqlSelectedIndex])
            }
            return
          case 'Escape':
            event.preventDefault()
            setSoqlSuggestions([])
            return
        }
      }
      // Enter always executes query (regardless of suggestions)
      if (event.key === 'Enter' && soqlQuery.trim()) {
        event.preventDefault()
        setSoqlSuggestions([])
        executeQuery()
        return
      }
    }

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
        // Check if query is a Salesforce ID - navigate directly
        if (isSalesforceId(query) && onIdNavigate) {
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
              const cmdtApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${cmdtApiName}.`)
            } else {
              const parentType = selectedResult.metadata?._parentType
              const recordName = selectedResult.metadata?.DeveloperName || selectedResult.name
              if (parentType) {
                setQuery(`${parentType}.${recordName}`)
              }
            }
          } else if (selectedResult.type === 'CustomSetting') {
            if (selectedResult.metadata?._isSettingDefinition) {
              const settingApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
              setQuery(`${settingApiName}.`)
            } else {
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

  // Get SOQL result columns
  const soqlColumns = soqlResult?.records?.[0]
    ? Object.keys(soqlResult.records[0]).filter(k => k !== 'attributes')
    : []

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      if ('attributes' in (value as any)) {
        const obj = value as Record<string, unknown>
        const copy = { ...obj }
        delete copy.attributes
        return JSON.stringify(copy)
      }
      return JSON.stringify(value)
    }
    return String(value)
  }

  const modalClassName = [
    'ultraforce-search-modal',
    isSOQLMode ? 'ultraforce-search-modal--soql' : '',
    isSOQLMode && soqlResult ? 'ultraforce-search-modal--soql-result' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
      <style>{SEARCH_MODAL_STYLES}</style>
      <div className="ultraforce-backdrop" onClick={handleBackdropClick}>
        <div
          className={modalClassName}
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
                onCursorChange={(pos) => {
                  if (!isSOQLMode) return
                  if (soqlStartIndex === null) {
                    setSoqlCursorPos(0)
                    return
                  }
                  if (pos >= soqlStartIndex) {
                    setSoqlCursorPos(pos - soqlStartIndex)
                  }
                }}
                sfHost={sfHost}
              />

              {showCommandHints && (
                <CommandHints commands={matchingCommands} />
              )}

              {/* SOQL Mode */}
              {isSOQLMode ? (
                <>
                  {/* SOQL Suggestions */}
                  {soqlSuggestions.length > 0 && (
                    <div className="soql-suggestions" ref={soqlSuggestionsRef}>
                      {soqlSuggestions.map((suggestion, index) => (
                        <div
                          key={`${suggestion.value}-${index}`}
                          data-soql-index={index}
                          className={`soql-suggestion-item ${index === soqlSelectedIndex ? 'selected' : ''}`}
                          onClick={() => applySoqlSuggestion(suggestion)}
                        >
                          <span className={`soql-suggestion-type type-${suggestion.type}`}>
                            {suggestion.type === 'keyword' && 'K'}
                            {suggestion.type === 'object' && 'O'}
                            {suggestion.type === 'field' && 'F'}
                            {suggestion.type === 'function' && 'fn'}
                            {suggestion.type === 'operator' && 'op'}
                          </span>
                          <span className="soql-suggestion-value">{suggestion.value}</span>
                          {suggestion.label !== suggestion.value && (
                            <span className="soql-suggestion-label">{suggestion.label}</span>
                          )}
                          {suggestion.detail && (
                            <span className="soql-suggestion-detail">{suggestion.detail}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SOQL Loading */}
                  {soqlLoading && (
                    <div className="loading-container">
                      <div className="spinner"></div>
                      <span>Executing query...</span>
                    </div>
                  )}

                  {/* SOQL Error */}
                  {soqlError && (
                    <div className="soql-error">
                      <span className="error-icon">!</span>
                      <span className="error-message">{soqlError}</span>
                    </div>
                  )}

                  {/* SOQL Results */}
                  {soqlResult && !soqlLoading && (
                    <div className="soql-results">
                      <div className="soql-results-header">
                        <span className="results-count">
                          {soqlResult.totalSize} record{soqlResult.totalSize !== 1 ? 's' : ''}
                          {!soqlResult.done && ' (partial)'}
                        </span>
                        <div className="export-buttons">
                          {exportMessage && <span className="export-success">{exportMessage}</span>}
                          <button className="export-btn" onClick={() => handleExport('csv')} title="Copy as CSV">
                            CSV
                          </button>
                          <button className="export-btn" onClick={() => handleExport('json')} title="Copy as JSON">
                            JSON
                          </button>
                          <button className="export-btn" onClick={() => handleExport('excel')} title="Copy as Excel (TSV)">
                            Excel
                          </button>
                        </div>
                      </div>

                      {soqlResult.records.length > 0 && (
                        <div className="soql-table-container">
                          <table className="soql-table">
                            <thead>
                              <tr>
                                {soqlColumns.map((col) => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {soqlResult.records.map((record, rowIndex) => (
                                <tr key={rowIndex}>
                                  {soqlColumns.map((col) => (
                                    <td key={col}>{formatCellValue(record[col])}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SOQL Empty State */}
                  {!soqlLoading && !soqlError && !soqlResult && soqlSuggestions.length === 0 && (
                    <EmptyState type="command" commandTypes={[]} commandDescription="Type SOQL query, press Enter to execute" />
                  )}
                </>
              ) : (
                <>
                  {/* Normal search mode */}
                  {!hasSession ? (
                    <EmptyState type="no-session" />
                  ) : isLoading ? (
                    <EmptyState type="loading" />
                  ) : searchError ? (
                    <EmptyState type="error" errorMessage={searchError} />
                  ) : !query.trim() ? (
                    <EmptyState type="start" selectedTypes={selectedTypes} />
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
                </>
              )}
            </div>

            <div className="search-footer">
              <div className="shortcuts">
                {isSOQLMode ? (
                  <>
                    <div className="shortcut-item">
                      <kbd>Tab</kbd> Autocomplete
                    </div>
                    <div className="shortcut-item">
                      <kbd>Enter</kbd> Execute
                    </div>
                    <div className="shortcut-item">
                      <kbd>Esc</kbd> Close
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
