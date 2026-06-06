import React, { useState, useEffect, useMemo, useCallback } from "react"
import type { SearchResult } from "~types"
import type { FavoriteItem } from "~stores/favorites-store"
import ResultItem, { type ObjectAction } from "./ResultItem"

interface ResultRowProps {
  result: SearchResult
  isSelected: boolean
  isFavorite?: boolean
  onResultClick: (result: SearchResult) => void
  onActionClick?: (result: SearchResult, action: ObjectAction) => void
  onToggleFavorite?: (item: Omit<FavoriteItem, 'pinnedAt'>) => void
}

// Memoized row that derives a stable per-row onClick from the stable parent
// callback, so ResultItem's `onClick: () => void` interface stays intact while
// avoiding a fresh closure each render.
const ResultRow: React.FC<ResultRowProps> = React.memo(
  ({ result, isSelected, isFavorite, onResultClick, onActionClick, onToggleFavorite }) => {
    const handleClick = useCallback(() => onResultClick(result), [onResultClick, result])
    return (
      <ResultItem
        result={result}
        isSelected={isSelected}
        onClick={handleClick}
        onActionClick={onActionClick}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    )
  }
)

interface SearchResultsProps {
  results: Record<string, SearchResult[]>
  selectedIndex: number
  onResultClick: (result: SearchResult) => void
  onActionClick?: (result: SearchResult, action: ObjectAction) => void
  onVisibleCountChange?: (count: number) => void
  collapsedGroups?: Record<string, boolean>
  onToggleCollapse?: (type: string) => void
  onToggleFavorite?: (item: Omit<FavoriteItem, 'pinnedAt'>) => void
  isFavorite?: (id: string) => boolean
}

const METADATA_LABELS: Record<string, string> = {
  "ApexClass": "Apex Classes",
  "ApexTrigger": "Apex Triggers",
  "CustomObject": "Custom Objects",
  "CustomField": "Custom Fields",
  "Flow": "Flows",
  "PermissionSet": "Permission Sets",
  "Profile": "Profiles"
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  selectedIndex,
  onResultClick,
  onActionClick,
  onVisibleCountChange,
  collapsedGroups: externalCollapsedGroups,
  onToggleCollapse,
  onToggleFavorite,
  isFavorite
}) => {
  const [internalCollapsedGroups, setInternalCollapsedGroups] = useState<Record<string, boolean>>({})

  const collapsedGroups = externalCollapsedGroups ?? internalCollapsedGroups

  const toggleGroupCollapse = (type: string) => {
    if (onToggleCollapse) {
      onToggleCollapse(type)
    } else {
      setInternalCollapsedGroups(prev => ({
        ...prev,
        [type]: !prev[type]
      }))
    }
  }

  const visibleItems = useMemo(() => {
    const items: { result: SearchResult; type: string }[] = []
    Object.entries(results).forEach(([type, typeResults]) => {
      if (typeResults.length === 0) return
      if (!collapsedGroups[type]) {
        typeResults.forEach(result => {
          items.push({ result, type })
        })
      }
    })
    return items
  }, [results, collapsedGroups])

  useEffect(() => {
    onVisibleCountChange?.(visibleItems.length)
  }, [visibleItems.length, onVisibleCountChange])

  let currentIndex = 0

  return (
    <div className="search-results" data-ultraforce-results>
      {Object.entries(results).map(([type, typeResults]) => {
        if (typeResults.length === 0) return null

        const isCollapsed = collapsedGroups[type] || false
        const label = METADATA_LABELS[type] || type

        const groupItems = isCollapsed ? null : typeResults.map((result) => {
          const globalIndex = currentIndex++
          return (
            <ResultRow
              key={result.id}
              result={result}
              isSelected={globalIndex === selectedIndex}
              isFavorite={isFavorite?.(result.id)}
              onResultClick={onResultClick}
              onActionClick={onActionClick}
              onToggleFavorite={onToggleFavorite}
            />
          )
        })

        return (
          <div key={type} className="result-group">
            <div
              className="result-group-header"
              onClick={() => toggleGroupCollapse(type)}
            >
              <span className={`group-chevron ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
              <span className="group-title">{label}</span>
              <span className="group-count">{typeResults.length}</span>
            </div>

            {groupItems}
          </div>
        )
      })}
    </div>
  )
}

export default SearchResults
