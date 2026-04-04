import React, { forwardRef, useEffect, useRef, useCallback } from 'react'

type OrgType = 'production' | 'sandbox' | 'scratch' | 'developer' | 'unknown'

interface SearchInputProps {
  query: string
  onQueryChange: (query: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  sfHost: string | null
}

function detectOrgType(sfHost: string | null): OrgType {
  if (!sfHost) {
    return 'unknown'
  }

  const host = sfHost.toLowerCase()

  if (host.includes('.scratch.') || host.includes('scratch.my.salesforce')) {
    return 'scratch'
  }

  if (host.includes('.sandbox.') || host.includes('--') || host.includes('.cs') ||
      /--\w+\./.test(host) || host.includes('sandbox.my.salesforce')) {
    return 'sandbox'
  }

  if (host.includes('-dev.') || host.includes('developer.')) {
    return 'developer'
  }

  // Production - includes Alibaba domains (.sfcrmproducts.cn / .sfcrmapps.cn)
  if (host.includes('.my.salesforce.') || host.includes('.lightning.force.') ||
      host.includes('.sfcrmproducts.cn') || host.includes('.sfcrmapps.cn')) {
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

    // Internal ref to attach native event listener
    const internalRef = useRef<HTMLInputElement | null>(null)

    // Stable callback ref to avoid re-registering listener on every render
    const onQueryChangeRef = useRef(onQueryChange)
    useEffect(() => {
      onQueryChangeRef.current = onQueryChange
    }, [onQueryChange])

    // Merge forwarded ref and internal ref
    const setRefs = useCallback((el: HTMLInputElement | null) => {
      internalRef.current = el
      if (typeof ref === 'function') {
        ref(el)
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
      }
    }, [ref])

    // Listen for custom 'ultraforce-input' events from the keyboard interceptor.
    // This bypasses React's event delegation which doesn't work reliably
    // in Shadow DOM for programmatically dispatched events.
    useEffect(() => {
      const el = internalRef.current
      if (!el) return

      const handler = (e: Event) => {
        const value = (e as CustomEvent).detail?.value ?? ''
        onQueryChangeRef.current(value)
      }

      el.addEventListener('ultraforce-input', handler)
      return () => el.removeEventListener('ultraforce-input', handler)
    }, [])

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
          ref={setRefs}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            onKeyDown(e)
          }}
          onKeyUp={(e) => {
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
          }}
          onKeyPress={(e) => {
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
          }}
          placeholder={
            displayName ? `Search ${displayName} metadata...` : 'Search Salesforce metadata...'
          }
          className="search-input"
          data-ultraforce-input
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
