import type { SearchCommand } from '~types'

export const DEFAULT_COMMANDS: Record<string, SearchCommand> = {
  o: { key: 'o', types: ['CustomObject', 'CustomField'], description: 'Objects & Fields' },
  c: { key: 'c', types: ['ApexClass', 'ApexTrigger'], description: 'Apex' },
  w: { key: 'w', types: ['Flow'], description: 'Flows' },
  u: { key: 'u', types: ['User'], description: 'Users' },
  p: { key: 'p', types: ['PermissionSet'], description: 'Permission Sets' },
  r: { key: 'r', types: ['Profile'], description: 'Profiles' },
  l: { key: 'l', types: ['CustomLabel'], description: 'Custom Labels' },
  s: { key: 's', types: ['CustomSetting'], description: 'Custom Settings' }
}

export interface ParsedCommand {
  isCommand: boolean
  commandKey: string | null
  query: string
  types: string[] | null
}

export function parseCommand(
  input: string,
  commands: Record<string, SearchCommand> = DEFAULT_COMMANDS
): ParsedCommand {
  const trimmed = input.trim()

  if (!trimmed.startsWith(':')) {
    return {
      isCommand: false,
      commandKey: null,
      query: trimmed,
      types: null
    }
  }

  const withoutPrefix = trimmed.slice(1)
  const spaceIndex = withoutPrefix.indexOf(' ')

  if (spaceIndex === -1) {
    const commandKey = withoutPrefix.toLowerCase()
    const command = commands[commandKey]
    return {
      isCommand: true,
      commandKey,
      query: '',
      types: command?.types || null
    }
  }

  const commandKey = withoutPrefix.slice(0, spaceIndex).toLowerCase()
  const query = withoutPrefix.slice(spaceIndex + 1).trim()
  const command = commands[commandKey]

  return {
    isCommand: true,
    commandKey,
    query,
    types: command?.types || null
  }
}

export function getMatchingCommands(
  input: string,
  commands: Record<string, SearchCommand> = DEFAULT_COMMANDS
): SearchCommand[] {
  if (!input.startsWith(':')) return []

  const partial = input.slice(1).toLowerCase().split(' ')[0]
  if (!partial) {
    return Object.values(commands)
  }

  return Object.values(commands).filter(
    (cmd) =>
      cmd.key.toLowerCase().startsWith(partial) ||
      cmd.description.toLowerCase().includes(partial)
  )
}
