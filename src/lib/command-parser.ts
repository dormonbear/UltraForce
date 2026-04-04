import type { SearchCommand, BuiltinCommand, CustomCommand } from '~types'

export const BUILTIN_COMMANDS: Record<string, BuiltinCommand> = {
  o: { key: 'o', types: ['CustomObject', 'CustomField'], description: 'Objects & Fields', isBuiltin: true },
  c: { key: 'c', types: ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'AuraDefinitionBundle', 'LightningComponentBundle'], description: 'Custom Codes (Apex/Trigger/Visualforce/LWC/Aura)', isBuiltin: true },
  f: { key: 'f', types: ['Flow'], description: 'Flows', isBuiltin: true },
  u: { key: 'u', types: ['User'], description: 'Users', isBuiltin: true },
  p: { key: 'p', types: ['Profile', 'PermissionSet', 'PermissionSetGroup', 'CustomPermission'], description: 'Profiles & Permissions', isBuiltin: true },
  l: { key: 'l', types: ['CustomLabel'], description: 'Custom Labels', isBuiltin: true },
  m: { key: 'm', types: ['CustomMetadataType', 'CustomSetting'], description: 'Custom Metadata & Settings', isBuiltin: true },
  q: { key: 'q', types: ['Queue', 'Group'], description: 'Queues & Public Groups', isBuiltin: true },
  r: { key: 'r', types: ['Report', 'Dashboard'], description: 'Reports & Dashboards', isBuiltin: true },
  g: { key: 'g', types: [], description: 'Go to Setup', isBuiltin: true }
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
  commands: Record<string, SearchCommand> = DEFAULT_COMMANDS,
  unsupportedTypes: string[] = []
): SearchCommand[] {
  if (!input.startsWith(':')) return []

  const partial = input.slice(1).toLowerCase().split(' ')[0]

  // Filter out commands where all types are unsupported
  const filteredCommands = Object.values(commands).filter((cmd) => {
    // Commands with no types (like :g) or custom commands are always shown
    if (!('types' in cmd) || cmd.types.length === 0) return true
    // Check if at least one type is supported
    return cmd.types.some(type => !unsupportedTypes.includes(type))
  })

  if (!partial) {
    return filteredCommands
  }

  return filteredCommands.filter(
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

export function getCommandPrefix(parsed: ParsedCommand): string {
  if (parsed.isCommand && parsed.commandKey) {
    return `:${parsed.commandKey} `
  }
  return ''
}

export function mergeCommands(
  customCommands: Record<string, CustomCommand>
): Record<string, SearchCommand> {
  return { ...BUILTIN_COMMANDS, ...customCommands }
}

export function filterCommandsBySupported(
  commands: Record<string, BuiltinCommand>,
  unsupportedTypes: string[]
): Record<string, BuiltinCommand> {
  if (unsupportedTypes.length === 0) {
    return commands
  }

  const filtered: Record<string, BuiltinCommand> = {}
  for (const [key, cmd] of Object.entries(commands)) {
    // Commands with no types (like :g) are always shown
    if (cmd.types.length === 0) {
      filtered[key] = cmd
      continue
    }
    // Check if at least one type is supported
    const hasSupported = cmd.types.some(type => !unsupportedTypes.includes(type))
    if (hasSupported) {
      filtered[key] = cmd
    }
  }
  return filtered
}
