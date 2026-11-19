import { useEffect, useRef } from 'react'
import { t } from '~lib/i18n'
import type { SearchCommand } from '~types'
import { ActionIcon, SearchFooter } from './SearchChrome'
import type { getScopeDetails } from './command-scope'
import { getMetadataTypeLabel } from './metadata-type-label'

export const COMMAND_LISTBOX_ID = 'ultraforce-command-listbox'

export function getCommandOptionId(key: string | null): string | null {
  return key === null ? null : `ultraforce-command-option-${key}`
}

interface CommandPanelProps {
  options: (ReturnType<typeof getScopeDetails> & { command: SearchCommand })[]
  selectedKey: string | null
  onHighlight: (key: string) => void
  onChoose: (key: string) => void
  onBack: () => void
  isOpen: boolean
}

export default function CommandPanel({
  options,
  selectedKey,
  onHighlight,
  onChoose,
  onBack,
  isOpen
}: CommandPanelProps) {
  const selectedRow = useRef<HTMLDivElement>(null)
  const selected = options.find(({ command }) => command.key === selectedKey)
  const title = t('Choose a scope')

  useEffect(() => {
    if (isOpen) selectedRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedKey, isOpen])

  return (
    <div className="search-panel-view command-panel-view" aria-hidden={!isOpen} inert={!isOpen}>
      <div className="command-panel-header">
        <button type="button" className="command-panel-back" aria-label={t('Back to search')} onClick={onBack}>
          <ActionIcon icon="back" />
        </button>
        <h2>{title}</h2>
      </div>
      <div className="command-panel-columns">
        <div className="command-panel-list">
          <div id={COMMAND_LISTBOX_ID} role="listbox" aria-label={title}>
            {options.map(({ command, icon, label }) => {
              const active = command.key === selectedKey
              return (
                <div
                  className={`result-item command-panel-option${active ? ' selected' : ''}`}
                  key={command.key}
                  id={getCommandOptionId(command.key) ?? undefined}
                  ref={active ? selectedRow : undefined}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => onHighlight(command.key)}
                  onClick={() => onChoose(command.key)}
                >
                  <ActionIcon icon={icon} />
                  <span>{label}</span> <kbd>:{command.key}</kbd>
                </div>
              )
            })}
          </div>
          {options.length === 0 && <p role="status">{t('No matching scopes')}</p>}
        </div>
        <div className="command-panel-detail">
          {selected && (
            <>
              <p className="command-panel-description">{selected.title}</p>
              <h3>{t('Searches')}</h3>
              {!selected.command.isBuiltin ? (
                <p>{t('Custom SOQL command')}</p>
              ) : selected.command.types.length === 0 ? (
                <p>{t('Setup pages')}</p>
              ) : (
                <ul>
                  {selected.command.types.map((type) => (
                    <li key={type}>{getMetadataTypeLabel(type)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      <SearchFooter pickerOpen />
    </div>
  )
}
