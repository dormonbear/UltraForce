import { t } from '~lib/i18n'
// HomeScreen - Replaces the empty state when query is empty.
// Shows pinned favorites and recent history ordered by last visit time.

import React, { useMemo, useCallback } from 'react'
import { useHistoryStore, sortByLastVisited } from '~stores/history-store'
import { useFavoritesStore, type FavoriteItem } from '~stores/favorites-store'
import type { HistoryItem } from '~stores/history-store'

const MAX_RECENT_ITEMS = 8
const MAX_FAVORITE_ITEMS = 10

const TYPE_ICONS: Record<string, string> = {
  ApexClass: '</>',
  ApexTrigger: '</>',
  CustomObject: 'O',
  CustomField: 'F',
  Flow: 'FL',
  User: 'U',
  PermissionSet: 'PS',
  Profile: 'PR',
  LightningComponentBundle: 'LW',
  AuraDefinitionBundle: 'AU',
  ApexPage: 'VF',
  ApexComponent: 'VC',
  CustomLabel: 'CL',
  Record: 'R',
  SetupShortcut: 'S',
  CustomMetadataType: 'CM',
  CustomSetting: 'CS'
}

interface HomeScreenProps {
  /** Navigate to a URL directly. */
  onNavigate: (url: string) => void
  /** Toggle favorite status for an item. */
  onToggleFavorite: (item: Omit<FavoriteItem, 'pinnedAt'>) => void
  /** Remove item from history. */
  onRemoveHistoryItem: (id: string) => void
  /** Selected types hint for the search tips. */
  selectedTypes?: string[]
}

/** Get a short type icon/label for the item badge. */
function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] || type.charAt(0).toUpperCase()
}

/** Format relative time like "2m ago", "3h ago", "5d ago". */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('just now')
  if (minutes < 60) return t('{count}m ago', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('{count}h ago', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('{count}d ago', { count: days })
  return t('{count}mo ago', { count: Math.floor(days / 30) })
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onToggleFavorite,
  onRemoveHistoryItem,
  selectedTypes
}) => {
  const favorites = useFavoritesStore((s) => s.items)
  const historyItems = useHistoryStore((s) => s.items)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)

  const recentItems = useMemo(() => {
    const sorted = sortByLastVisited(historyItems)
    return sorted.slice(0, MAX_RECENT_ITEMS)
  }, [historyItems])

  const visibleFavorites = useMemo(() => favorites.slice(0, MAX_FAVORITE_ITEMS), [favorites])

  const handleItemClick = useCallback(
    (url: string) => {
      onNavigate(url)
    },
    [onNavigate]
  )

  const handleFavoriteToggle = useCallback(
    (e: React.MouseEvent, item: HistoryItem | FavoriteItem) => {
      e.stopPropagation()
      onToggleFavorite({
        id: item.id,
        name: item.name,
        type: item.type,
        url: item.url,
        description: item.description
      })
    },
    [onToggleFavorite]
  )

  const handleRemoveHistory = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      onRemoveHistoryItem(id)
    },
    [onRemoveHistoryItem]
  )

  const hasContent = visibleFavorites.length > 0 || recentItems.length > 0

  if (!hasContent) {
    return (
      <div className="home-screen">
        <div className="home-empty">
          <div className="home-empty-title">{t('Start searching')}</div>
          <div className="home-empty-desc">
            {t('Type to search {types}', {
              types: selectedTypes?.length ? t('your selected metadata types') : t('Salesforce metadata')
            })}
          </div>
          <div className="home-tips">
            <span className="home-tip">
              {t('Type')} <kbd>:</kbd> {t('for commands')}
            </span>
            <span className="home-tip">
              {t('Press')} <kbd>Tab</kbd> {t('to autocomplete')}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-screen">
      {visibleFavorites.length > 0 && (
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            {t('Favorites')}
          </div>
          <div className="home-items">
            {visibleFavorites.map((item) => (
              <div
                key={item.id}
                className="home-item"
                onClick={() => handleItemClick(item.url)}
                role="button"
                tabIndex={0}
                title={`${item.name} (${item.type})`}
              >
                <span className="home-item-badge" data-type={item.type}>
                  {getTypeIcon(item.type)}
                </span>
                <span className="home-item-name">
                  {['ProfileSubMenu', 'ProfileSetupLink', 'SetupShortcut'].includes(item.type)
                    ? t(item.name)
                    : item.name}
                </span>
                {item.description && (
                  <span className="home-item-desc">
                    {['ProfileSubMenu', 'ProfileSetupLink', 'SetupShortcut'].includes(item.type)
                      ? t(item.description)
                      : item.description}
                  </span>
                )}
                <button
                  className="home-item-action home-item-unpin"
                  onClick={(e) => handleFavoriteToggle(e, item)}
                  title={t('Unpin')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentItems.length > 0 && (
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            {t('Recent')}
          </div>
          <div className="home-items">
            {recentItems.map((item) => (
              <div
                key={`${item.id}-${item.type}`}
                className="home-item"
                onClick={() => handleItemClick(item.url)}
                role="button"
                tabIndex={0}
                title={t('{name} ({type}) - visited {count}x', {
                  name: item.name,
                  type: item.type,
                  count: item.visitCount
                })}
              >
                <span className="home-item-badge" data-type={item.type}>
                  {getTypeIcon(item.type)}
                </span>
                <span className="home-item-name">
                  {['ProfileSubMenu', 'ProfileSetupLink', 'SetupShortcut'].includes(item.type)
                    ? t(item.name)
                    : item.name}
                </span>
                <span className="home-item-time">{formatRelativeTime(item.lastVisitedAt)}</span>
                <button
                  className={`home-item-action home-item-pin${isFavorite(item.id) ? ' home-item-pinned' : ''}`}
                  onClick={(e) => handleFavoriteToggle(e, item)}
                  title={isFavorite(item.id) ? t('Unpin') : t('Pin to favorites')}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={isFavorite(item.id) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                <button
                  className="home-item-action home-item-remove"
                  onClick={(e) => handleRemoveHistory(e, item.id)}
                  title={t('Remove from history')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeScreen
