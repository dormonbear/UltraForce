import React from 'react'

interface EmptyStateProps {
  type: 'loading' | 'empty' | 'no-session' | 'start'
  query?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, query }) => {
  if (type === 'loading') {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Searching...</span>
      </div>
    )
  }

  if (type === 'start') {
    return (
      <div className="search-empty">
        <div className="empty-icon">Search</div>
        <div className="empty-title">Ready to Search</div>
        <div className="empty-desc">
          Start typing to search Salesforce metadata
          <br />
          <span style={{ fontSize: '11px', opacity: 0.6, marginTop: '6px', display: 'block' }}>
            Tip: Use dot-notation for fields (e.g., Account.Name)
          </span>
        </div>
      </div>
    )
  }

  if (type === 'empty') {
    return (
      <div className="search-empty">
        <div className="empty-icon">No Results</div>
        <div className="empty-title">No Results Found</div>
        <div className="empty-desc">We couldn't find anything matching "{query}"</div>
      </div>
    )
  }

  if (type === 'no-session') {
    return (
      <div className="search-empty">
        <div className="empty-icon">Locked</div>
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

  return null
}

export default EmptyState
