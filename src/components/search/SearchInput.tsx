import React, { forwardRef } from 'react'

type OrgType = 'production' | 'sandbox' | 'scratch' | 'developer' | 'unknown'

interface SearchInputProps {
  query: string
  onQueryChange: (query: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  sfHost: string | null
}

function detectOrgType(sfHost: string | null): OrgType {
  if (!sfHost) return 'unknown'

  const host = sfHost.toLowerCase()

  // Scratch org
  if (host.includes('.scratch.') || host.includes('scratch.my.salesforce')) {
    return 'scratch'
  }

  // Sandbox - check for sandbox patterns
  if (host.includes('.sandbox.') || host.includes('--') || host.includes('.cs') ||
      /--\w+\./.test(host) || host.includes('sandbox.my.salesforce')) {
    return 'sandbox'
  }

  // Developer Edition - usually has 'dev' in the name but not always reliable
  if (host.includes('-dev.') || host.includes('developer.')) {
    return 'developer'
  }

  // Production - default for .my.salesforce.com without sandbox/scratch indicators
  if (host.includes('.my.salesforce.') || host.includes('.lightning.force.')) {
    return 'production'
  }

  return 'unknown'
}

function getOrgTypeLabel(orgType: OrgType): string {
  switch (orgType) {
    case 'production': return 'PROD'
    case 'sandbox': return 'SANDBOX'
    case 'scratch': return 'SCRATCH'
    case 'developer': return 'DEV'
    default: return 'ORG'
  }
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ query, onQueryChange, onKeyDown, sfHost }, ref) => {
    const displayName = sfHost ? sfHost.split('.')[0] : null
    const orgType = detectOrgType(sfHost)

    return (
      <div className="search-input-section">
        <svg
          className="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            displayName ? `Search ${displayName} metadata...` : 'Search Salesforce metadata...'
          }
          className="search-input"
          autoFocus
        />
        {displayName && (
          <div className={`org-badge org-badge-${orgType}`} title={sfHost || ''}>
            {getOrgTypeLabel(orgType)}
          </div>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'

export default SearchInput
