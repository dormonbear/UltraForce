import type { CSSProperties } from 'react'
import { t } from '~lib/i18n'
import { ActionIcon } from './SearchChrome'

export type HomeSection = 'history' | 'favorites'

interface SearchBarActionsProps {
  activeSection: HomeSection | null
  hidden?: boolean
  settingsOpen: boolean
  onToggleSection: (section: HomeSection) => void
  onSettings: () => void
}

const sectionActions = [
  { section: 'history', label: 'History', icon: 'history' },
  { section: 'favorites', label: 'Favorites', icon: 'star' }
] as const

export function SettingsBarTitle() {
  return (
    <h2 className="search-input-section settings-bar-title" role="heading" aria-level={2}>
      <span className="search-icon">
        <ActionIcon icon="setup" />
      </span>
      {t('Settings')}
    </h2>
  )
}

export default function SearchBarActions({
  activeSection,
  hidden = false,
  settingsOpen,
  onToggleSection,
  onSettings
}: SearchBarActionsProps) {
  return (
    <div
      className="search-bar-actions"
      aria-hidden={hidden}
      inert={hidden}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.stopPropagation()
      }}
    >
      {sectionActions.map(({ section, label, icon }, index) => (
        <button
          key={section}
          type="button"
          className="search-bar-action"
          style={{ '--i': index } as CSSProperties}
          aria-hidden={settingsOpen}
          inert={settingsOpen}
          aria-label={t(label)}
          aria-pressed={activeSection === section}
          onClick={() => onToggleSection(section)}
        >
          <ActionIcon icon={icon} />
        </button>
      ))}
      <button
        type="button"
        className="search-bar-action"
        style={{ '--i': sectionActions.length } as CSSProperties}
        data-ultraforce-settings-button
        aria-label={t(settingsOpen ? 'Close settings' : 'Settings')}
        aria-pressed={settingsOpen}
        onClick={onSettings}
      >
        <span className="settings-toggle-icons" aria-hidden="true">
          <ActionIcon icon="setup" />
          <ActionIcon icon="close" />
        </span>
      </button>
    </div>
  )
}
