import type { CustomCommand, SearchCommand } from '~types'
import {
  BUILTIN_COMMANDS,
  DEFAULT_COMMANDS,
  filterCommandsBySupported,
  getCommandPrefix,
  getMatchingCommands,
  isKeyUnique,
  mergeCommands,
  parseCommand,
  validateCommandKey
} from './command-parser'

/**
 * Builds a command map with a synthetic `types` field on a custom entry (runtime shape only)
 * so getMatchingCommands filtering for all-unsupported types can be exercised.
 */
function commandMapWithTypedCustom(
  custom: CustomCommand,
  types: string[]
): Record<string, SearchCommand> {
  return {
    ...mergeCommands({ [custom.key]: custom }),
    [custom.key]: { ...custom, types } as unknown as SearchCommand
  }
}

describe('BUILTIN_COMMANDS and DEFAULT_COMMANDS', () => {
  it('should expose every builtin shortcut with isBuiltin true, key aligned to map, and description', () => {
    expect(Object.keys(BUILTIN_COMMANDS).length).toBeGreaterThan(0)
    for (const [mapKey, cmd] of Object.entries(BUILTIN_COMMANDS)) {
      expect(cmd.key).toBe(mapKey)
      expect(cmd.isBuiltin).toBe(true)
      expect(cmd.description.length).toBeGreaterThan(0)
    }
  })

  it('should list all documented builtin keys', () => {
    expect(Object.keys(BUILTIN_COMMANDS).sort()).toEqual(
      ['c', 'f', 'g', 'l', 'm', 'o', 'p', 'q', 'r', 'u'].sort()
    )
  })

  it('should include expected core shortcuts and :g setup navigation', () => {
    expect(BUILTIN_COMMANDS.o.types).toContain('CustomObject')
    expect(BUILTIN_COMMANDS.f.types).toContain('Flow')
    expect(BUILTIN_COMMANDS.g.types).toEqual([])
    expect(BUILTIN_COMMANDS.g.description).toBe('Go to Setup')
  })

  it('should use DEFAULT_COMMANDS as a shallow copy of the builtin map', () => {
    expect(Object.keys(DEFAULT_COMMANDS).sort()).toEqual(Object.keys(BUILTIN_COMMANDS).sort())
    expect(DEFAULT_COMMANDS).not.toBe(BUILTIN_COMMANDS)
    expect(DEFAULT_COMMANDS.o).toBe(BUILTIN_COMMANDS.o)
    expect(DEFAULT_COMMANDS.o).toEqual(BUILTIN_COMMANDS.o)
  })
})

describe('parseCommand', () => {
  it('should trim input and treat plain text as non-command', () => {
    const parsed = parseCommand('  Account  ')
    expect(parsed).toEqual({
      isCommand: false,
      commandKey: null,
      query: 'Account',
      types: null,
      command: null
    })
  })

  it('should parse command without query', () => {
    const parsed = parseCommand(':p')
    expect(parsed.isCommand).toBe(true)
    expect(parsed.commandKey).toBe('p')
    expect(parsed.query).toBe('')
    expect(parsed.command).toEqual(BUILTIN_COMMANDS.p)
    expect(parsed.types).toEqual(BUILTIN_COMMANDS.p.types)
  })

  it('should lowercase command key and parse query after first space', () => {
    const parsed = parseCommand(':P  System Admin ')
    expect(parsed.commandKey).toBe('p')
    expect(parsed.query).toBe('System Admin')
    expect(parsed.command).toEqual(BUILTIN_COMMANDS.p)
  })

  it('should split on first space only so remainder stays in query', () => {
    const parsed = parseCommand(':f Create Case Flow')
    expect(parsed.commandKey).toBe('f')
    expect(parsed.query).toBe('Create Case Flow')
  })

  it('should return null command for unknown key', () => {
    const parsed = parseCommand(':zzz thing')
    expect(parsed.isCommand).toBe(true)
    expect(parsed.commandKey).toBe('zzz')
    expect(parsed.query).toBe('thing')
    expect(parsed.command).toBeNull()
    expect(parsed.types).toBeNull()
  })

  it('should parse bare colon as command with empty commandKey', () => {
    const parsed = parseCommand(':')
    expect(parsed.isCommand).toBe(true)
    expect(parsed.commandKey).toBe('')
    expect(parsed.query).toBe('')
    expect(parsed.command).toBeNull()
    expect(parsed.types).toBeNull()
  })

  it('should parse colon-space as empty key and empty query', () => {
    const parsed = parseCommand(': ')
    expect(parsed.isCommand).toBe(true)
    expect(parsed.commandKey).toBe('')
    expect(parsed.query).toBe('')
  })

  it('should resolve commands from a custom map merged with builtins', () => {
    const custom: CustomCommand = {
      key: 'z',
      description: 'Custom',
      soql: 'SELECT Id FROM User',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ z: custom })
    const parsed = parseCommand(':z q', merged)
    expect(parsed.command).toEqual(custom)
    expect(parsed.types).toBeNull()
  })

  it('should set types to null for custom command when no space in input', () => {
    const custom: CustomCommand = {
      key: 'z',
      description: 'Custom',
      soql: 'SELECT Id FROM User',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ z: custom })
    const parsed = parseCommand(':z', merged)
    expect(parsed.command).toEqual(custom)
    expect(parsed.types).toBeNull()
  })

  it('should resolve custom commands from an explicit merged record', () => {
    const custom: CustomCommand = {
      key: 'x',
      description: 'Extra',
      soql: 'SELECT Id FROM User',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = { ...DEFAULT_COMMANDS, x: custom }
    const result = parseCommand(':x admin', merged)
    expect(result.commandKey).toBe('x')
    expect(result.query).toBe('admin')
    expect(result.types).toBeNull()
    expect(result.command).toEqual(custom)
  })
})

describe('getMatchingCommands', () => {
  it('should return empty array when input does not start with colon', () => {
    expect(getMatchingCommands('Account')).toEqual([])
    expect(getMatchingCommands('objects')).toEqual([])
    expect(getMatchingCommands('')).toEqual([])
  })

  it('should return all supported commands when only colon is present', () => {
    const all = getMatchingCommands(':')
    expect(all.length).toBe(Object.keys(BUILTIN_COMMANDS).length)
    expect(all.map((c) => c.key).sort()).toEqual(Object.keys(BUILTIN_COMMANDS).sort())
  })

  it('should match by command key prefix', () => {
    const matches = getMatchingCommands(':o')
    expect(matches.some((c) => c.key === 'o')).toBe(true)
    expect(
      matches.every(
        (c) => c.key.toLowerCase().startsWith('o') || c.description.toLowerCase().includes('o')
      )
    ).toBe(true)
  })

  it('should normalize partial token case-insensitively', () => {
    const lower = getMatchingCommands(':flow')
    const upper = getMatchingCommands(':FLOW')
    expect(lower.map((c) => c.key).sort()).toEqual(upper.map((c) => c.key).sort())
    const byKey = getMatchingCommands(':O')
    expect(byKey.some((c) => c.key === 'o')).toBe(true)
  })

  it('should match by description substring', () => {
    const matches = getMatchingCommands(':flow')
    expect(matches.some((c) => c.key === 'f')).toBe(true)
  })

  it('should use first token after colon for partial match when more tokens exist', () => {
    const matches = getMatchingCommands(':o Account')
    expect(matches.some((c) => c.key === 'o')).toBe(true)
  })

  it('should hide builtins whose types are all unsupported', () => {
    const flowOnlyUnsupported = getMatchingCommands(':', BUILTIN_COMMANDS, ['Flow'])
    expect(flowOnlyUnsupported.some((c) => c.key === 'f')).toBe(false)
    expect(flowOnlyUnsupported.some((c) => c.key === 'g')).toBe(true)
  })

  it('should hide :o when every object-related type is unsupported', () => {
    const oTypes = [...BUILTIN_COMMANDS.o.types]
    const matches = getMatchingCommands(':', DEFAULT_COMMANDS, oTypes)
    expect(matches.find((c) => c.key === 'o')).toBeUndefined()
    expect(matches.find((c) => c.key === 'g')).toBeDefined()
  })

  it('should keep builtins when at least one type remains supported', () => {
    const partialObjectUnsupported = getMatchingCommands(':', BUILTIN_COMMANDS, ['CustomObject'])
    expect(partialObjectUnsupported.some((c) => c.key === 'o')).toBe(true)
  })

  it('should keep :o when only one of its types is unsupported', () => {
    const partialUnsupported = ['CustomObject']
    const matches = getMatchingCommands(':', DEFAULT_COMMANDS, partialUnsupported)
    expect(matches.find((c) => c.key === 'o')).toBeDefined()
  })

  it('should always include custom commands without types field', () => {
    const custom: CustomCommand = {
      key: 'z',
      description: 'Zeta query',
      soql: 'SELECT Id FROM User',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ z: custom })
    const matches = getMatchingCommands(':z', merged, ['Flow', 'ApexClass'])
    expect(matches.some((c) => c.key === 'z')).toBe(true)
  })

  it('should treat leading space after colon as empty partial and list all filtered', () => {
    const matches = getMatchingCommands(': o', BUILTIN_COMMANDS, [])
    expect(matches.length).toBe(Object.keys(BUILTIN_COMMANDS).length)
  })

  it('should omit custom entries when all runtime types are unsupported', () => {
    const custom: CustomCommand = {
      key: 't',
      description: 'Typed custom',
      soql: 'SELECT Id FROM Flow',
      useToolingApi: true,
      isBuiltin: false,
      nameField: 'Name'
    }
    const map = commandMapWithTypedCustom(custom, ['Flow'])
    expect(getMatchingCommands(':t', map, ['Flow']).find((c) => c.key === 't')).toBeUndefined()
    expect(getMatchingCommands(':t', map, []).find((c) => c.key === 't')).toBeDefined()
  })

  it('should return no matches when partial matches neither key nor description', () => {
    const matches = getMatchingCommands(':qqqq', DEFAULT_COMMANDS, [])
    expect(matches).toEqual([])
  })
})

describe('isKeyUnique', () => {
  it('should return false when key exists in commands', () => {
    expect(isKeyUnique('o', BUILTIN_COMMANDS)).toBe(false)
    expect(isKeyUnique('O', BUILTIN_COMMANDS)).toBe(false)
  })

  it('should return true when key is not taken', () => {
    expect(isKeyUnique('zzz', BUILTIN_COMMANDS)).toBe(true)
    expect(isKeyUnique('zz', DEFAULT_COMMANDS)).toBe(true)
  })

  it('should allow key equal to excludeKey when editing same command', () => {
    expect(isKeyUnique('o', BUILTIN_COMMANDS, 'o')).toBe(true)
    expect(isKeyUnique('O', BUILTIN_COMMANDS, 'o')).toBe(true)
  })

  it('should still reject when key matches a different command than exclude', () => {
    expect(isKeyUnique('o', BUILTIN_COMMANDS, 'p')).toBe(false)
  })
})

describe('validateCommandKey', () => {
  it('should reject empty or whitespace-only keys', () => {
    expect(validateCommandKey('')).toEqual({ valid: false, error: 'Command is required' })
    expect(validateCommandKey('   ')).toEqual({ valid: false, error: 'Command is required' })
  })

  it('should reject keys longer than 10 characters', () => {
    expect(validateCommandKey('abcdefghijk')).toEqual({
      valid: false,
      error: 'Command must be 10 characters or less'
    })
  })

  it('should accept keys at exactly 10 characters', () => {
    expect(validateCommandKey('abcdefghij')).toEqual({ valid: true })
  })

  it('should reject keys that do not start with a letter', () => {
    expect(validateCommandKey('1ab')).toEqual({
      valid: false,
      error: 'Command must start with a letter and contain only letters and numbers'
    })
  })

  it('should reject keys with invalid characters', () => {
    expect(validateCommandKey('a-b')).toEqual({
      valid: false,
      error: 'Command must start with a letter and contain only letters and numbers'
    })
  })

  it('should reject keys with spaces', () => {
    expect(validateCommandKey('a b')).toEqual({
      valid: false,
      error: 'Command must start with a letter and contain only letters and numbers'
    })
  })

  it('should accept valid alphanumeric keys', () => {
    expect(validateCommandKey('a')).toEqual({ valid: true })
    expect(validateCommandKey('a1')).toEqual({ valid: true })
    expect(validateCommandKey('ab12')).toEqual({ valid: true })
    expect(validateCommandKey('Z9')).toEqual({ valid: true })
  })
})

describe('getCommandPrefix', () => {
  it('should return empty string for non-command queries', () => {
    const parsed = parseCommand('Account')
    expect(getCommandPrefix(parsed)).toBe('')
  })

  it('should return empty string when command key is empty despite leading colon', () => {
    expect(getCommandPrefix(parseCommand(':'))).toBe('')
    expect(getCommandPrefix(parseCommand(': '))).toBe('')
  })

  it('should return ":p " for :p command', () => {
    const parsed = parseCommand(':p System Administrator')
    expect(getCommandPrefix(parsed)).toBe(':p ')
  })

  it('should return ":m " for :m command', () => {
    const parsed = parseCommand(':m My_Setting__mdt')
    expect(getCommandPrefix(parsed)).toBe(':m ')
  })

  it('should return ":o " for :o command', () => {
    const parsed = parseCommand(':o Account')
    expect(getCommandPrefix(parsed)).toBe(':o ')
  })

  it('should return ":p " when query is just the command', () => {
    const parsed = parseCommand(':p')
    expect(getCommandPrefix(parsed)).toBe(':p ')
  })

  it('should work with dot-notation queries', () => {
    const parsed = parseCommand(':p System Administrator.')
    expect(getCommandPrefix(parsed)).toBe(':p ')
    expect(parsed.query).toBe('System Administrator.')
  })

  it('should work with two-level dot-notation queries', () => {
    const parsed = parseCommand(':p System Administrator.Users.')
    expect(getCommandPrefix(parsed)).toBe(':p ')
    expect(parsed.query).toBe('System Administrator.Users.')
  })

  it('should return empty string when parsedCommand has no commandKey', () => {
    const parsed = parseCommand('System Administrator.')
    expect(getCommandPrefix(parsed)).toBe('')
  })

  it('should prefix unknown but parsed command keys', () => {
    const parsed = parseCommand(':unknown x')
    expect(parsed.commandKey).toBe('unknown')
    expect(getCommandPrefix(parsed)).toBe(':unknown ')
  })
})

describe('Tab completion prefix preservation', () => {
  it('should reconstruct full query with prefix for Profile Tab', () => {
    const parsed = parseCommand(':p System Administrator')
    const prefix = getCommandPrefix(parsed)
    const profileName = 'System Administrator'
    const newQuery = `${prefix}${profileName}.`
    expect(newQuery).toBe(':p System Administrator.')
  })

  it('should reconstruct full query with prefix for ProfileSubMenu Tab', () => {
    const parsed = parseCommand(':p System Administrator.')
    const prefix = getCommandPrefix(parsed)
    const profileName = 'System Administrator'
    const subCategory = 'Users'
    const newQuery = `${prefix}${profileName}.${subCategory}.`
    expect(newQuery).toBe(':p System Administrator.Users.')
  })

  it('should reconstruct full query with prefix for CustomObject Tab', () => {
    const parsed = parseCommand(':o Account')
    const prefix = getCommandPrefix(parsed)
    const objectApiName = 'Account'
    const newQuery = `${prefix}${objectApiName}.`
    expect(newQuery).toBe(':o Account.')
  })

  it('should reconstruct full query with prefix for CMDT Tab', () => {
    const parsed = parseCommand(':m My_Setting__mdt')
    const prefix = getCommandPrefix(parsed)
    const cmdtApiName = 'My_Setting__mdt'
    const newQuery = `${prefix}${cmdtApiName}.`
    expect(newQuery).toBe(':m My_Setting__mdt.')
  })

  it('should not add prefix when no command is used', () => {
    const parsed = parseCommand('Account')
    const prefix = getCommandPrefix(parsed)
    const objectApiName = 'Account'
    const newQuery = `${prefix}${objectApiName}.`
    expect(newQuery).toBe('Account.')
  })
})

describe('mergeCommands', () => {
  it('should include all builtins plus custom entries', () => {
    const custom: CustomCommand = {
      key: 'z',
      description: 'Z',
      soql: 'SELECT Id FROM User',
      useToolingApi: true,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ z: custom })
    expect(merged.o).toEqual(BUILTIN_COMMANDS.o)
    expect(merged.z).toEqual(custom)
  })

  it('should return only builtins when custom map is empty', () => {
    const merged = mergeCommands({})
    expect(Object.keys(merged).sort()).toEqual(Object.keys(BUILTIN_COMMANDS).sort())
    expect(merged).toEqual({ ...BUILTIN_COMMANDS })
  })

  it('should let custom command override builtin with same key', () => {
    const override: CustomCommand = {
      key: 'o',
      description: 'Override objects',
      soql: 'SELECT Id FROM Account',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ o: override })
    expect(merged.o).toEqual(override)
    expect(merged.o.isBuiltin).toBe(false)
  })

  it('should preserve additional custom commands when overriding one builtin', () => {
    const a: CustomCommand = {
      key: 'o',
      description: 'O',
      soql: 'SELECT Id FROM Account',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const b: CustomCommand = {
      key: 'soql1',
      description: 'Accounts',
      soql: 'SELECT Id FROM Account',
      useToolingApi: false,
      isBuiltin: false,
      nameField: 'Name'
    }
    const merged = mergeCommands({ o: a, soql1: b })
    expect(merged.o).toEqual(a)
    expect(merged.soql1).toEqual(b)
  })
})

describe('filterCommandsBySupported', () => {
  it('should return the same reference when unsupportedTypes is empty', () => {
    expect(filterCommandsBySupported(BUILTIN_COMMANDS, [])).toBe(BUILTIN_COMMANDS)
  })

  it('should keep commands with no metadata types', () => {
    const filtered = filterCommandsBySupported(BUILTIN_COMMANDS, ['Flow', 'ApexClass'])
    expect(filtered.g).toEqual(BUILTIN_COMMANDS.g)
  })

  it('should remove commands when every type is unsupported', () => {
    const filtered = filterCommandsBySupported(BUILTIN_COMMANDS, ['Flow'])
    expect(filtered.f).toBeUndefined()
  })

  it('should remove :o when all of its types are listed as unsupported', () => {
    const unsupported = [...BUILTIN_COMMANDS.o.types]
    const filtered = filterCommandsBySupported(BUILTIN_COMMANDS, unsupported)
    expect(filtered.o).toBeUndefined()
  })

  it('should keep command when any type is still supported', () => {
    const filtered = filterCommandsBySupported(BUILTIN_COMMANDS, ['CustomObject'])
    expect(filtered.o).toEqual(BUILTIN_COMMANDS.o)
  })

  it('should drop multiple builtins when each has only unsupported types', () => {
    const unsupported = [...new Set([...BUILTIN_COMMANDS.f.types, ...BUILTIN_COMMANDS.u.types])]
    const filtered = filterCommandsBySupported(BUILTIN_COMMANDS, unsupported)
    expect(filtered.f).toBeUndefined()
    expect(filtered.u).toBeUndefined()
    expect(filtered.g).toBeDefined()
  })
})
