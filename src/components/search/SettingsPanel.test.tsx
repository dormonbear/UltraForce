import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { CustomCommand } from '~types'

vi.mock('~lib/api-stats', () => ({
  getApiStats: vi.fn().mockResolvedValue({ total: 0, last24h: 0, lastMonth: 0 }),
  resetAllStats: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('~lib/salesforce-api', () => ({
  getUnsupportedTypes: vi.fn().mockResolvedValue([]),
  clearMetadataCache: vi.fn().mockResolvedValue(undefined),
  warmupMetadataCache: vi.fn().mockResolvedValue(undefined)
}))

import SettingsPanel from './SettingsPanel'

function renderPanel(overrides: Partial<React.ComponentProps<typeof SettingsPanel>> = {}) {
  const onCustomCommandsChange = vi.fn()
  const props = {
    onClose: vi.fn(),
    selectedTypes: ['ApexClass'],
    onToggleType: vi.fn(),
    shortcutKey: 'b',
    onShortcutChange: vi.fn(),
    closeOnNavigate: true,
    onCloseOnNavigateChange: vi.fn(),
    autoLoadFields: false,
    onAutoLoadFieldsChange: vi.fn(),
    fuzzySearch: true,
    onFuzzySearchChange: vi.fn(),
    hideManagedPackage: true,
    onHideManagedPackageChange: vi.fn(),
    maxResultsPerType: 10,
    onMaxResultsPerTypeChange: vi.fn(),
    navigationMode: 'auto' as const,
    onNavigationModeChange: vi.fn(),
    sfHost: 'myorg.my.salesforce.com',
    customCommands: {} as Record<string, CustomCommand>,
    onCustomCommandsChange,
    ...overrides
  }
  render(<SettingsPanel {...props} />)
  return { onCustomCommandsChange, props }
}

async function openAddForm() {
  const addBtn = await screen.findByText(/Add Command/i)
  fireEvent.click(addBtn)
  await screen.findByPlaceholderText('e.g. log')
}

describe('SettingsPanel custom commands', () => {
  beforeEach(() => cleanup())

  it('saves a valid new command with the lowercased key and parsed description fields', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'LOG' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. My Logs'), { target: { value: 'My Logs' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: "SELECT Id, Name FROM Account WHERE Name LIKE '%{query}%'" }
    })
    fireEvent.change(screen.getByPlaceholderText('Field1, Field2'), { target: { value: 'Industry, Phone' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onCustomCommandsChange).toHaveBeenCalledTimes(1)
    const saved = onCustomCommandsChange.mock.calls[0][0]
    expect(saved.log).toMatchObject({
      key: 'log',
      description: 'My Logs',
      isBuiltin: false,
      nameField: 'Name',
      descriptionFields: ['Industry', 'Phone']
    })
  })

  it('shows a validation error and does not save when SOQL lacks {query}', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'log' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. My Logs'), { target: { value: 'My Logs' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: 'SELECT Id FROM Account' }
    })
    fireEvent.click(screen.getByText('Save'))
    expect(screen.getByText(/SOQL must contain \{query\} placeholder/)).toBeTruthy()
    expect(onCustomCommandsChange).not.toHaveBeenCalled()
  })

  it('shows a validation error when description is empty', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'log' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: "SELECT Id FROM Account WHERE Name LIKE '%{query}%'" }
    })
    fireEvent.click(screen.getByText('Save'))
    expect(screen.getByText(/Description is required/)).toBeTruthy()
    expect(onCustomCommandsChange).not.toHaveBeenCalled()
  })

  it('lists an existing custom command and deletes it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const existing: Record<string, CustomCommand> = {
      log: { key: 'log', description: 'My Logs', soql: "SELECT Id FROM ApexLog WHERE Id LIKE '%{query}%'", useToolingApi: true, isBuiltin: false, nameField: 'Id' }
    }
    const { onCustomCommandsChange } = renderPanel({ customCommands: existing })
    expect(await screen.findByText('My Logs')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Delete'))
    expect(onCustomCommandsChange).toHaveBeenCalledWith({})
    confirmSpy.mockRestore()
  })

  it('loads an existing command into the form on Edit and re-saves it', async () => {
    const existing: Record<string, CustomCommand> = {
      log: { key: 'log', description: 'My Logs', soql: "SELECT Id FROM ApexLog WHERE Name LIKE '%{query}%'", useToolingApi: true, isBuiltin: false, nameField: 'Id', descriptionFields: ['Operation'] }
    }
    const { onCustomCommandsChange } = renderPanel({ customCommands: existing })
    fireEvent.click(await screen.findByTitle('Edit'))
    expect((screen.getByPlaceholderText('e.g. log') as HTMLInputElement).value).toBe('log')
    expect((screen.getByPlaceholderText('Field1, Field2') as HTMLInputElement).value).toBe('Operation')
    fireEvent.click(screen.getByText('Save'))
    expect(onCustomCommandsChange).toHaveBeenCalled()
  })
})
