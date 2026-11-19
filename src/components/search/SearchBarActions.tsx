import { t } from '~lib/i18n'
import { ActionIcon } from './SearchChrome'

export type HomeSection = 'history' | 'favorites'

interface SearchBarActionsProps {
  activeSection: HomeSection | null
  onToggleSection: (section: HomeSection) => void
  onSettings: () => void
}

const sectionActions = [
  { section: 'history', label: 'History', icon: 'history' },
  { section: 'favorites', label: 'Favorites', icon: 'star' }
] as const

export default function SearchBarActions({ activeSection, onToggleSection, onSettings }: SearchBarActionsProps) {
  return (
    <div
      className="search-bar-actions"
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.stopPropagation()
      }}
    >
      {sectionActions.map(({ section, label, icon }) => (
        <button
          key={section}
          type="button"
          className="search-bar-action"
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
        data-ultraforce-settings-button
        aria-label={t('Settings')}
        onClick={onSettings}
      >
        <ActionIcon icon="setup" />
      </button>
    </div>
  )
}
