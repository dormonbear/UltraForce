import type { CSSProperties } from 'react'
import { t } from '~lib/i18n'
import type { SearchCommand } from '~types'

interface CommandHintsProps {
  commands: SearchCommand[]
  prefix?: string
}

export default function CommandHints({ commands, prefix = '' }: CommandHintsProps) {
  if (commands.length === 0) return null

  const normalizedPrefix = prefix.toLowerCase()

  return (
    <div className="command-hints">
      <h2 className="command-hints-heading">{t('Commands')}</h2>
      <ul className="command-hint-list">
        {commands.map((command, index) => {
          const token = `:${command.key}`
          const matchLength = token.toLowerCase().startsWith(normalizedPrefix) ? prefix.length : 0

          return (
            <li key={command.key} className="command-hint-tag" style={{ '--i': index } as CSSProperties}>
              <kbd className="command-key">
                {matchLength > 0 && <span className="command-key-match">{token.slice(0, matchLength)}</span>}
                {token.slice(matchLength)}
              </kbd>
              <span className="command-desc">{command.isBuiltin ? t(command.description) : command.description}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
