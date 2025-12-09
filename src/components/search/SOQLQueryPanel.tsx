import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { AutocompleteSuggestion, QueryResult, ExportFormat } from '~types/soql'
import { getAutocompleteSuggestions, insertSuggestion } from '~lib/soql-autocomplete'
import { exportRecords, copyToClipboard } from '~lib/export-utils'
import { sfRest, API_VERSION } from '~lib/auth'

interface SOQLQueryPanelProps {
  sfHost: string | null
  initialQuery?: string
  onClose?: () => void
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  string: 'Aa',
  textarea: 'T',
  id: '#',
  reference: '>',
  boolean: '?',
  int: '1',
  double: '1.0',
  currency: '$',
  percent: '%',
  date: 'D',
  datetime: 'DT',
  time: 'Ti',
  email: '@',
  phone: 'Ph',
  url: 'Url',
  picklist: 'P',
  multipicklist: 'MP',
  address: 'Ad',
  location: 'Lo'
}

const SOQLQueryPanel: React.FC<SOQLQueryPanelProps> = ({
  sfHost,
  initialQuery = 'SELECT ',
  onClose
}) => {
  const [query, setQuery] = useState(initialQuery)
  const [cursorPosition, setCursorPosition] = useState(initialQuery.length)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)

  const fetchSuggestions = useCallback(
    async (q: string, pos: number) => {
      if (!sfHost) return

      setIsLoadingSuggestions(true)
      try {
        const results = await getAutocompleteSuggestions(sfHost, q, pos)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedSuggestionIndex(0)
      } catch (err) {
        console.warn('Failed to fetch suggestions:', err)
        setSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    },
    [sfHost]
  )

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newQuery = e.target.value
      const newPosition = e.target.selectionStart || 0

      setQuery(newQuery)
      setCursorPosition(newPosition)
      setError(null)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = window.setTimeout(() => {
        fetchSuggestions(newQuery, newPosition)
      }, 150)
    },
    [fetchSuggestions]
  )

  const handleSelectionChange = useCallback(() => {
    if (inputRef.current) {
      const newPosition = inputRef.current.selectionStart || 0
      if (newPosition !== cursorPosition) {
        setCursorPosition(newPosition)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = window.setTimeout(() => {
          fetchSuggestions(query, newPosition)
        }, 150)
      }
    }
  }, [cursorPosition, query, fetchSuggestions])

  const applySuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      const { newQuery, newCursorPosition } = insertSuggestion(
        query,
        cursorPosition,
        suggestion
      )
      setQuery(newQuery)
      setCursorPosition(newCursorPosition)
      setShowSuggestions(false)

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
        }
      }, 0)

      setTimeout(() => {
        fetchSuggestions(newQuery, newCursorPosition)
      }, 100)
    },
    [query, cursorPosition, fetchSuggestions]
  )

  const executeQuery = useCallback(async () => {
    if (!sfHost || !query.trim()) return

    setIsExecuting(true)
    setError(null)
    setQueryResult(null)

    try {
      const encodedQuery = encodeURIComponent(query.trim())
      const result = await sfRest(sfHost, `/services/data/v${API_VERSION}/query/?q=${encodedQuery}`)
      setQueryResult(result)
      setShowSuggestions(false)
    } catch (err: any) {
      setError(err.message || 'Query execution failed')
    } finally {
      setIsExecuting(false)
    }
  }, [sfHost, query])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!queryResult?.records?.length) return

      const content = exportRecords(queryResult.records, format)
      const success = await copyToClipboard(content)

      if (success) {
        setExportSuccess(`Copied as ${format.toUpperCase()}`)
        setTimeout(() => setExportSuccess(null), 2000)
      }
    },
    [queryResult]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          )
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          )
          return
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          applySuggestion(suggestions[selectedSuggestionIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowSuggestions(false)
          return
        }
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        executeQuery()
        return
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion, executeQuery]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(query.length, query.length)
    }
  }, [])

  useEffect(() => {
    if (suggestionsRef.current && showSuggestions) {
      const selectedEl = suggestionsRef.current.children[selectedSuggestionIndex] as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedSuggestionIndex, showSuggestions])

  const getFieldTypeIcon = (dataType?: string): string => {
    if (!dataType) return ''
    return FIELD_TYPE_ICONS[dataType.toLowerCase()] || ''
  }

  const columns = queryResult?.records?.[0]
    ? Object.keys(queryResult.records[0]).filter((k) => k !== 'attributes')
    : []

  return (
    <div className="soql-panel">
      <div className="soql-input-section">
        <textarea
          ref={inputRef}
          className="soql-input"
          value={query}
          onChange={handleQueryChange}
          onSelect={handleSelectionChange}
          onKeyDown={handleKeyDown}
          placeholder="SELECT Id, Name FROM Account"
          spellCheck={false}
        />
        <div className="soql-actions">
          <button
            className="soql-run-btn"
            onClick={executeQuery}
            disabled={isExecuting || !query.trim()}
          >
            {isExecuting ? 'Running...' : 'Run'}
            <span className="shortcut-hint">Cmd+Enter</span>
          </button>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="soql-suggestions" ref={suggestionsRef}>
          <div className="suggestions-header">
            {isLoadingSuggestions ? 'Loading...' : 'Suggestions'}
          </div>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.value}-${index}`}
              className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
              onClick={() => applySuggestion(suggestion)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <span className={`suggestion-icon type-${suggestion.type}`}>
                {suggestion.type === 'field' && getFieldTypeIcon(suggestion.dataType)}
                {suggestion.type === 'object' && 'O'}
                {suggestion.type === 'relationship' && '>'}
                {suggestion.type === 'keyword' && 'K'}
                {suggestion.type === 'function' && 'f'}
              </span>
              <span className="suggestion-value">{suggestion.value}</span>
              {suggestion.label !== suggestion.value && (
                <span className="suggestion-label">{suggestion.label}</span>
              )}
              {suggestion.dataType && (
                <span className="suggestion-type">{suggestion.dataType}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="soql-error">
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {queryResult && (
        <div className="soql-results">
          <div className="results-header">
            <span className="results-count">
              {queryResult.totalSize} record{queryResult.totalSize !== 1 ? 's' : ''}
              {!queryResult.done && ' (partial)'}
            </span>
            <div className="export-buttons">
              {exportSuccess && <span className="export-success">{exportSuccess}</span>}
              <button
                className="export-btn"
                onClick={() => handleExport('csv')}
                title="Copy as CSV"
              >
                CSV
              </button>
              <button
                className="export-btn"
                onClick={() => handleExport('markdown')}
                title="Copy as Markdown"
              >
                MD
              </button>
              <button
                className="export-btn"
                onClick={() => handleExport('excel')}
                title="Copy as Excel (TSV)"
              >
                Excel
              </button>
            </div>
          </div>

          {queryResult.records.length > 0 && (
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.records.map((record, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((col) => (
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
    </div>
  )
}

function formatCellValue(value: unknown): string {
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

export default SOQLQueryPanel
