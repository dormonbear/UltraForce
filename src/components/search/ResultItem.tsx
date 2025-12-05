import React, { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '~types'

export type ObjectAction = 'list' | 'fields' | 'layouts' | 'details' | 'preview'

interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onClick: () => void
  onActionClick?: (result: SearchResult, action: ObjectAction) => void
}

const ActionButton: React.FC<{
  icon: React.ReactNode
  title: string
  onClick: (e: React.MouseEvent) => void
}> = ({ icon, title, onClick }) => (
  <button
    className="object-action-btn"
    title={title}
    onClick={onClick}
  >
    {icon}
  </button>
)

const ResultItem: React.FC<ResultItemProps> = ({ result, isSelected, onClick, onActionClick }) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [isSelected])

  const handleActionClick = (action: ObjectAction) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onActionClick?.(result, action)
  }

  const handleCopyApiName = (e: React.MouseEvent) => {
    e.stopPropagation()
    const apiName = result.metadata?.QualifiedApiName || result.name
    navigator.clipboard.writeText(apiName).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isCustomObject = result.type === 'CustomObject'
  const isCustomField = result.type === 'CustomField'
  const isApex = result.type === 'ApexClass' || result.type === 'ApexTrigger'
  const isApexPage = result.type === 'ApexPage'
  const isLightningComponent = result.type === 'LightningComponentBundle' || result.type === 'AuraDefinitionBundle'

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }

  const lastModifiedBy = result.metadata?.LastModifiedBy?.Name
  const lastModifiedDate = result.metadata?.LastModifiedDate

  return (
    <div
      ref={itemRef}
      className={`result-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="result-info">
        <div className="result-name">{result.name}</div>
        {result.description && <div className="result-description">{result.description}</div>}
      </div>

      <div className="result-actions">
        {isApex && lastModifiedDate && (
          <div className="result-meta">
            {lastModifiedBy && <span className="meta-user">{lastModifiedBy}</span>}
            <span className="meta-date">{formatDate(lastModifiedDate)}</span>
          </div>
        )}

        {(isApexPage || isLightningComponent) && (
          <div className="object-actions">
            <ActionButton
              title="Preview"
              onClick={handleActionClick('preview')}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              }
            />
          </div>
        )}

        {result.namespace && <div className="result-namespace">{result.namespace}</div>}

        {isCustomField && (
          <div className="object-actions">
            <ActionButton
              title={copied ? 'Copied!' : 'Copy API Name'}
              onClick={handleCopyApiName}
              icon={
                copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )
              }
            />
          </div>
        )}

        {isCustomObject && (
          <div className="object-actions">
            <ActionButton
              title="Fields"
              onClick={handleActionClick('fields')}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              }
            />
            <ActionButton
              title="Page Layouts"
              onClick={handleActionClick('layouts')}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              }
            />
            <ActionButton
              title="Object Settings"
              onClick={handleActionClick('details')}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultItem
