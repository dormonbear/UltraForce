import type { SearchCommand } from '~types'

export function splitCommandChip(query: string, commands: Readonly<Record<string, SearchCommand>>) {
  const match = /^:(\S+)\s/.exec(query)
  if (!match) return { chip: null, remainder: query }

  const key = match[1].toLowerCase()
  if (!Object.hasOwn(commands, key)) return { chip: null, remainder: query }

  return { chip: commands[key], remainder: query.slice(match[0].length) }
}
