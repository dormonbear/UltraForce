import type { SearchCommand, BuiltinCommand, CustomCommand, isCustomCommand } from '~types'

export const BUILTIN_COMMANDS: Record<string, BuiltinCommand> = {
  o: { key: 'o', types: ['CustomObject', 'CustomField'], description: 'Objects & Fields', isBuiltin: true },
  c: { key: 'c', types: ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'AuraDefinitionBundle', 'LightningComponentBundle'], description: 'Custom Codes (Apex/Trigger/Visualforce/LWC/Aura)', isBuiltin: true },
  f: { key: 'f', types: ['Flow'], description: 'Flows', isBuiltin: true },
  u: { key: 'u', types: ['User'], description: 'Users', isBuiltin: true },
  p: { key: 'p', types: ['Profile', 'PermissionSet', 'PermissionSetGroup', 'CustomPermission'], description: 'Profiles & Permissions', isBuiltin: true },
  l: { key: 'l', types: ['CustomLabel'], description: 'Custom Labels', isBuiltin: true },
  m: { key: 'm', types: ['CustomMetadataType', 'CustomSetting'], description: 'Custom Metadata & Settings', isBuiltin: true },
  g: { key: 'g', types: [], description: 'Go to Setup', isBuiltin: true },
  s: { key: 's', types: [], description: 'SOQL Query', isBuiltin: true }
}

export const DEFAULT_COMMANDS: Record<string, SearchCommand> = { ...BUILTIN_COMMANDS }

export interface ParsedCommand {
  isCommand: boolean
  commandKey: string | null
  query: string
  types: string[] | null
  command: SearchCommand | null
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
      types: null,
      command: null
    }
  }

  const withoutPrefix = trimmed.slice(1)
  const spaceIndex = withoutPrefix.indexOf(' ')

  if (spaceIndex === -1) {
    const commandKey = withoutPrefix.toLowerCase()
    const command = commands[commandKey] || null
    return {
      isCommand: true,
      commandKey,
      query: '',
      types: command && 'types' in command ? command.types : null,
      command
    }
  }

  const commandKey = withoutPrefix.slice(0, spaceIndex).toLowerCase()
  const query = withoutPrefix.slice(spaceIndex + 1).trim()
  const command = commands[commandKey] || null

  return {
    isCommand: true,
    commandKey,
    query,
    types: command && 'types' in command ? command.types : null,
    command
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

export function isKeyUnique(
  key: string,
  commands: Record<string, SearchCommand>,
  excludeKey?: string
): boolean {
  const normalizedKey = key.toLowerCase()
  if (excludeKey && normalizedKey === excludeKey.toLowerCase()) {
    return true
  }
  return !commands[normalizedKey]
}

export function validateCommandKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'Command is required' }
  }
  if (key.length > 10) {
    return { valid: false, error: 'Command must be 10 characters or less' }
  }
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
    return { valid: false, error: 'Command must start with a letter and contain only letters and numbers' }
  }
  return { valid: true }
}

export function mergeCommands(
  customCommands: Record<string, CustomCommand>
): Record<string, SearchCommand> {
  return { ...BUILTIN_COMMANDS, ...customCommands }
}
