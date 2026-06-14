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
vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { waitFor } from '@testing-library/react'
import { getApiStats } from '~lib/api-stats'
import { logger } from '~lib/logger'
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

describe('SettingsPanel error logging', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('logs a warning when getApiStats rejects', async () => {
    vi.mocked(getApiStats).mockRejectedValueOnce(new Error('boom'))
    renderPanel()
    await waitFor(() => {
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        'getApiStats failed',
        expect.objectContaining({ error: expect.any(Error) })
      )
    })
  })
})

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

describe('SettingsPanel toggles and export', () => {
  beforeEach(() => cleanup())

  it('calls onClose when the back button is clicked', async () => {
    const onClose = vi.fn()
    renderPanel({ onClose })
    await screen.findByText('Settings')
    const backButton = document.querySelector('.back-button') as HTMLButtonElement
    fireEvent.click(backButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('toggles a metadata type via onToggleType', async () => {
    const onToggleType = vi.fn()
    renderPanel({ onToggleType })
    // selectedTypes=['ApexClass']; the Apex option covers ApexClass,ApexTrigger.
    // Not all selected => isChecked false => toggles the missing one (ApexTrigger).
    const apexLabel = await screen.findByText('Apex Classes & Triggers')
    const checkbox = apexLabel.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(onToggleType).toHaveBeenCalledWith('ApexTrigger')
  })

  it('changes the shortcut key via the select', async () => {
    const onShortcutChange = vi.fn()
    renderPanel({ onShortcutChange })
    const select = (await screen.findByDisplayValue('B')).closest('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'i' } })
    expect(onShortcutChange).toHaveBeenCalledWith('i')
  })

  it('fires onCloseOnNavigateChange when toggling close-on-navigate', async () => {
    const onCloseOnNavigateChange = vi.fn()
    renderPanel({ closeOnNavigate: true, onCloseOnNavigateChange })
    const label = await screen.findByText('Close modal after opening result')
    const checkbox = label.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(onCloseOnNavigateChange).toHaveBeenCalledWith(false)
  })

  it('fires onAutoLoadFieldsChange when toggling auto-load fields', async () => {
    const onAutoLoadFieldsChange = vi.fn()
    renderPanel({ autoLoadFields: false, onAutoLoadFieldsChange })
    const label = await screen.findByText('Auto-load all fields on Setup pages')
    const checkbox = label.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(onAutoLoadFieldsChange).toHaveBeenCalledWith(true)
  })

  it('fires onFuzzySearchChange when toggling fuzzy search', async () => {
    const onFuzzySearchChange = vi.fn()
    renderPanel({ fuzzySearch: true, onFuzzySearchChange })
    const label = await screen.findByText('Fuzzy search (typo-tolerant matching)')
    const checkbox = label.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(onFuzzySearchChange).toHaveBeenCalledWith(false)
  })

  it('fires onHideManagedPackageChange when toggling hide managed package', async () => {
    const onHideManagedPackageChange = vi.fn()
    renderPanel({ hideManagedPackage: true, onHideManagedPackageChange })
    const label = await screen.findByText('Hide managed package items')
    const checkbox = label.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(onHideManagedPackageChange).toHaveBeenCalledWith(false)
  })

  it('fires onMaxResultsPerTypeChange with a numeric value', async () => {
    const onMaxResultsPerTypeChange = vi.fn()
    renderPanel({ maxResultsPerType: 10, onMaxResultsPerTypeChange })
    const label = await screen.findByText('Max results per type')
    const select = label.closest('.toggle-option')!.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '50' } })
    expect(onMaxResultsPerTypeChange).toHaveBeenCalledWith(50)
  })

  it('changes navigation mode via the radio inputs', async () => {
    const onNavigationModeChange = vi.fn()
    renderPanel({ navigationMode: 'auto', onNavigationModeChange })
    const label = await screen.findByText('Salesforce Classic')
    const radio = label.closest('label')!.querySelector('input') as HTMLInputElement
    fireEvent.click(radio)
    expect(onNavigationModeChange).toHaveBeenCalledWith('classic')
  })

  it('disables the export button when there are no custom commands', async () => {
    renderPanel({ customCommands: {} })
    const exportBtn = (await screen.findByText('Export')) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(true)
  })

  it('exports custom commands to a JSON blob when export is clicked', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const existing: Record<string, CustomCommand> = {
      log: { key: 'log', description: 'My Logs', soql: "SELECT Id FROM ApexLog WHERE Name LIKE '%{query}%'", useToolingApi: true, isBuiltin: false, nameField: 'Id', descriptionFields: ['Operation'] }
    }
    renderPanel({ customCommands: existing })
    const exportBtn = (await screen.findByText('Export')) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(false)
    fireEvent.click(exportBtn)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = createObjectURL.mock.calls[0][0] as Blob
    expect(blobArg.type).toBe('application/json')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x')

    clickSpy.mockRestore()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })

  it('rebuilds the metadata cache when the rebuild button is clicked', async () => {
    const { clearMetadataCache, warmupMetadataCache } = await import('~lib/salesforce-api')
    renderPanel({ sfHost: 'myorg.my.salesforce.com' })
    const rebuildBtn = await screen.findByText('Rebuild Cache')
    fireEvent.click(rebuildBtn)
    await screen.findByText('Rebuild Cache')
    expect(clearMetadataCache).toHaveBeenCalled()
    expect(warmupMetadataCache).toHaveBeenCalledWith('myorg.my.salesforce.com')
  })
})
