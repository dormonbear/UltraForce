import React from 'react'
import type { SearchCommand } from '~types'

interface CommandHintsProps {
  commands: SearchCommand[]
}

const CommandHints: React.FC<CommandHintsProps> = ({ commands }) => {
  if (commands.length === 0) return null

  return (
    <div className="command-hints">
      {commands.map((cmd) => (
        <span key={cmd.key} className="command-hint-tag">
          <span className="command-key">:{cmd.key}</span>
          <span className="command-desc">{cmd.description}</span>
        </span>
      ))}
    </div>
  )
}

export default CommandHints
