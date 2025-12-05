import React, { useMemo } from 'react'

interface EmptyStateProps {
  type: 'loading' | 'empty' | 'no-session' | 'start' | 'command' | 'error'
  query?: string
  commandTypes?: string[]
  commandDescription?: string
  selectedTypes?: string[]
  errorMessage?: string
}

const SEARCH_HINTS = [
  'Type : for commands (e.g., :c for Apex, :o for Objects)',
  'Use dot-notation for fields (e.g., Account.Name)',
  'Use dot-notation for CMDT records (e.g., My_Setting__mdt.Record)',
  'Press Tab to autocomplete object names',
  'Press Enter to open the selected result',
  'Use Up/Down arrows to navigate results',
  'Toggle fuzzy search in Settings for typo-tolerant matching',
  'Hide managed package items in Settings'
]

const TYPE_LABELS: Record<string, string> = {
  ApexClass: 'Apex Classes',
  ApexTrigger: 'Apex Triggers',
  CustomObject: 'Objects',
  CustomField: 'Fields',
  Flow: 'Flows',
  User: 'Users',
  PermissionSet: 'Permission Sets',
  Profile: 'Profiles',
  CustomLabel: 'Custom Labels',
  CustomMetadataType: 'Custom Metadata Types',
  CustomSetting: 'Custom Settings'
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, query, commandTypes, commandDescription, selectedTypes, errorMessage }) => {
  const randomHint = useMemo(() => {
    return SEARCH_HINTS[Math.floor(Math.random() * SEARCH_HINTS.length)]
  }, [])

  if (type === 'loading') {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Searching...</span>
      </div>
    )
  }

  if (type === 'command') {
    const title = commandTypes && commandTypes.length > 0
      ? `Searching ${commandTypes.join(', ')}`
      : commandDescription || 'Custom Search'
    return (
      <div className="search-empty">
        <div className="empty-icon">🔍</div>
        <div className="empty-title">{title}</div>
        <div className="empty-desc">Type to search</div>
      </div>
    )
  }

  if (type === 'start') {
    const typeLabels = selectedTypes?.map((t) => TYPE_LABELS[t] || t).join(', ') || 'metadata'
    return (
      <div className="search-empty">
        <div className="empty-title">Searching {typeLabels}</div>
        <div className="empty-desc">
          <span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>
            Tip: {randomHint}
          </span>
        </div>
      </div>
    )
  }

  if (type === 'empty') {
    return (
      <div className="search-empty">
        <div className="empty-icon">📭</div>
        <div className="empty-title">No Results Found</div>
        <div className="empty-desc">We couldn't find anything matching "{query}"</div>
      </div>
    )
  }

  if (type === 'no-session') {
    return (
      <div className="search-empty">
        <div className="empty-icon">🔒</div>
        <div className="empty-title">Not Logged In</div>
        <div className="empty-desc">
          Please log in to Salesforce in this browser to use UltraForce.
          <br />
          <span style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px', display: 'block' }}>
            UltraForce uses your browser session to access Salesforce APIs.
          </span>
        </div>
      </div>
    )
  }

  if (type === 'error') {
    const lines = (errorMessage || 'An error occurred').split('\n')
    return (
      <div className="search-empty search-error">
        <div className="empty-icon">⚠️</div>
        <div className="empty-title">Search Error</div>
        <div className="empty-desc error-message">
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default EmptyState
