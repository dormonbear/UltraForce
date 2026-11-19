import { describe, expect, it } from 'vitest'
import { splitCommandChip } from './command-chip'
import { BUILTIN_COMMANDS, mergeCommands } from './command-parser'

describe('splitCommandChip', () => {
  const commands = mergeCommands({
    accounts: {
      key: 'accounts',
      description: 'Account search',
      soql: 'SELECT Id, Name FROM Account',
      isBuiltin: false,
      useToolingApi: false,
      nameField: 'Name'
    }
  })

  it.each([
    [':f create case', 'f', 'create case'],
    [':f ', 'f', ''],
    [':F x', 'f', 'x'],
    [':f  create case ', 'f', ' create case '],
    [':accounts acme', 'accounts', 'acme']
  ])('splits %j into a scope and remainder / 将 %j 拆分为范围和剩余文本', (query, key, remainder) => {
    expect(splitCommandChip(query, commands)).toEqual({ chip: commands[key], remainder })
  })

  it.each([':f', ':zz foo', ':constructor foo'])('keeps %j as plain text / 将 %j 保留为纯文本', (query) => {
    expect(splitCommandChip(query, BUILTIN_COMMANDS)).toEqual({ chip: null, remainder: query })
  })
})
