import React, { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react'

type OrgType = 'production' | 'sandbox' | 'scratch' | 'developer' | 'unknown'

interface SearchInputProps {
  query: string
  onQueryChange: (query: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onCursorChange?: (position: number) => void
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

const MAX_TEXTAREA_HEIGHT_PX = 120

const SearchInput = forwardRef<HTMLTextAreaElement, SearchInputProps>(
  ({ query, onQueryChange, onKeyDown, onCursorChange, sfHost }, ref) => {
    const displayName = sfHost ? sfHost.split('.')[0] : null
    const orgType = detectOrgType(sfHost)
    const [isMultiline, setIsMultiline] = useState(false)

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const singleLineHeightPxRef = useRef<number | null>(null)

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textAreaRef.current = node
        if (!ref) return
        if (typeof ref === 'function') {
          ref(node)
        } else {
          ref.current = node
        }
      },
      [ref]
    )

    const getSingleLineHeightPx = (el: HTMLTextAreaElement): number => {
      const style = window.getComputedStyle(el)
      const fontSizePx = Number.parseFloat(style.fontSize || '16') || 16
      const lineHeightRaw = Number.parseFloat(style.lineHeight)
      const lineHeightPx = Number.isFinite(lineHeightRaw) && lineHeightRaw > 0 ? lineHeightRaw : fontSizePx * 1.25
      const paddingTopPx = Number.parseFloat(style.paddingTop || '0') || 0
      const paddingBottomPx = Number.parseFloat(style.paddingBottom || '0') || 0
      return lineHeightPx + paddingTopPx + paddingBottomPx
    }

    const resize = useCallback(() => {
      const el = textAreaRef.current
      if (!el) return
      if (singleLineHeightPxRef.current === null) {
        singleLineHeightPxRef.current = getSingleLineHeightPx(el)
      }
      el.style.height = 'auto'
      const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)
      el.style.height = `${nextHeight}px`
      el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT_PX ? 'auto' : 'hidden'

      const singleLineHeightPx = singleLineHeightPxRef.current ?? getSingleLineHeightPx(el)
      setIsMultiline(el.scrollHeight > singleLineHeightPx + 1)
    }, [])

    useLayoutEffect(() => {
      resize()
    }, [resize, query])

    const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement
      if (onCursorChange && target.selectionStart !== null) {
        onCursorChange(target.selectionStart)
      }
    }

    return (
      <div className={`search-input-section ${isMultiline ? 'search-input-section--multiline' : ''}`}>
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
        <textarea
          ref={setRefs}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            handleCursorChange(e)
          }}
          onKeyDown={onKeyDown}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          onSelect={handleCursorChange}
          placeholder={
            displayName ? `Search ${displayName} metadata...` : 'Search Salesforce metadata...'
          }
          className="search-input"
          autoFocus
          rows={1}
          wrap="soft"
          spellCheck={false}
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
