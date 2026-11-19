import React from 'react'
import { t } from '~lib/i18n'

const ACTION_ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  'aria-hidden': true
}

export function ActionIcon({ icon }: { icon: string }): React.ReactNode {
  switch (icon) {
    case 'layout':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      )
    case 'type':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'sharing':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'history':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'star':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
        </svg>
      )
    case 'related':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      )
    case 'clone':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    case 'setup':
      return (
        <svg {...ACTION_ICON_PROPS}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return (
        <svg {...ACTION_ICON_PROPS}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      )
  }
}

export function SearchFooter({ liveStatusText }: { liveStatusText: string }) {
  return (
    <>
      <div className="ultraforce-sr-only" role="status" aria-atomic="true">
        {liveStatusText}
      </div>

      <div className="search-footer">
        <div className="shortcuts">
          <div className="shortcut-item">
            <kbd>{t('Up/Down')}</kbd> {t('Navigate')}
          </div>
          <div className="shortcut-item">
            <kbd>Tab</kbd> {t('Autocomplete')}
          </div>
          <div className="shortcut-item">
            <kbd>Enter</kbd> {t('Open')}
          </div>
          <div className="shortcut-item">
            <kbd>Esc</kbd> {t('Close')}
          </div>
        </div>
      </div>
    </>
  )
}

export function StorageWarning({ messages, onDismiss }: { messages: string[]; onDismiss: () => void }) {
  if (!messages.length) return null
  return (
    <div className="storage-warning" role="alert">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="storage-warning-text">{messages.map((message) => t(message)).join(' ')}</span>
      <button
        className="storage-warning-dismiss"
        onClick={onDismiss}
        title={t('Dismiss')}
        aria-label={t('Dismiss storage warning')}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export interface RecordAction {
  id: string
  name: string
  handler: () => void
  icon: string
  description?: string
}

export function RecordActions({
  actions,
  objectApiName,
  selectedIndex
}: {
  actions: RecordAction[]
  objectApiName: string | null
  selectedIndex: number
}) {
  return (
    <div className="record-actions">
      <div className="record-actions-header">
        {t('Record Actions')}
        {objectApiName && <span className="record-object-name">{objectApiName}</span>}
      </div>
      <div className="record-actions-list">
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={`record-action-item${selectedIndex === index ? ' selected' : ''}`}
            onClick={action.handler}
            role="button"
            tabIndex={0}
            title={t(action.name)}
            onKeyDown={(e) => e.key === 'Enter' && action.handler()}
          >
            <span className="record-action-icon">
              <ActionIcon icon={action.icon} />
            </span>
            <span className="record-action-text">{t(action.name)}</span>
            <span className="record-action-desc">{t(action.description ?? action.name)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
