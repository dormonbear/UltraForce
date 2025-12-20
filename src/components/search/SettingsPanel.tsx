import React, { useState } from 'react'
import type { SearchCommand, CustomCommand } from '~types'
import { BUILTIN_COMMANDS, isKeyUnique, validateCommandKey, mergeCommands } from '~lib/command-parser'

type NavigationMode = 'auto' | 'lightning' | 'classic'

interface SettingsPanelProps {
  onClose: () => void
  selectedTypes: string[]
  onToggleType: (type: string) => void
  shortcutKey: string
  onShortcutChange: (key: string) => void
  closeOnNavigate: boolean
  onCloseOnNavigateChange: (value: boolean) => void
  autoLoadFields: boolean
  onAutoLoadFieldsChange: (value: boolean) => void
  fuzzySearch: boolean
  onFuzzySearchChange: (value: boolean) => void
  hideManagedPackage: boolean
  onHideManagedPackageChange: (value: boolean) => void
  maxResultsPerType: number
  onMaxResultsPerTypeChange: (value: number) => void
  navigationMode: NavigationMode
  onNavigationModeChange: (mode: NavigationMode) => void
  sfHost: string | null
  customCommands: Record<string, CustomCommand>
  onCustomCommandsChange: (commands: Record<string, CustomCommand>) => void
}

const METADATA_TYPES = [
  { value: 'ApexClass,ApexTrigger', label: 'Apex Classes & Triggers' },
  { value: 'ApexPage,ApexComponent', label: 'Visualforce Pages & Components' },
  { value: 'AuraDefinitionBundle,LightningComponentBundle', label: 'Aura & Lightning Web Components' },
  { value: 'CustomObject,CustomField', label: 'Objects & Fields' },
  { value: 'Flow', label: 'Flows' },
  { value: 'CustomLabel', label: 'Custom Labels' },
  { value: 'CustomMetadataType', label: 'Custom Metadata Types' },
  { value: 'CustomSetting', label: 'Custom Settings' },
  { value: 'PermissionSet', label: 'Permission Sets' },
  { value: 'Profile', label: 'Profiles' },
  { value: 'Queue,Group', label: 'Queues & Public Groups' }
]

const NAVIGATION_MODES = [
  { value: 'auto', label: 'Auto (Follow User)' },
  { value: 'lightning', label: 'Lightning Experience' },
  { value: 'classic', label: 'Salesforce Classic' }
]

const getAppVersion = () => {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return 'unknown'
  }
}
const PRIVACY_URL = 'https://gist.github.com/dormonbear/14242e4e5effbf0c7159c0e2bc14bbda'

interface CommandFormState {
  key: string
  description: string
  soql: string
  useToolingApi: boolean
  nameField: string
  descriptionFields: string
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onClose,
  selectedTypes,
  onToggleType,
  shortcutKey,
  onShortcutChange,
  closeOnNavigate,
  onCloseOnNavigateChange,
  autoLoadFields,
  onAutoLoadFieldsChange,
  fuzzySearch,
  onFuzzySearchChange,
  hideManagedPackage,
  onHideManagedPackageChange,
  maxResultsPerType,
  onMaxResultsPerTypeChange,
  navigationMode,
  onNavigationModeChange,
  sfHost,
  customCommands,
  onCustomCommandsChange
}) => {
  const displayName = sfHost ? sfHost.split('.')[0] : null
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [formState, setFormState] = useState<CommandFormState>({
    key: '',
    description: '',
    soql: '',
    useToolingApi: false,
    nameField: 'Name',
    descriptionFields: ''
  })
  const [formError, setFormError] = useState<string | null>(null)

  const allCommands = mergeCommands(customCommands)

  const handleEditCommand = (cmd: CustomCommand) => {
    setEditingKey(cmd.key)
    setIsAddingNew(false)
    setFormState({
      key: cmd.key,
      description: cmd.description,
      soql: cmd.soql,
      useToolingApi: cmd.useToolingApi,
      nameField: cmd.nameField || 'Name',
      descriptionFields: cmd.descriptionFields?.join(', ') || ''
    })
    setFormError(null)
  }

  const handleSaveCommand = () => {
    const keyValidation = validateCommandKey(formState.key)
    if (!keyValidation.valid) {
      setFormError(keyValidation.error || 'Invalid command')
      return
    }

    if (!isKeyUnique(formState.key, allCommands, editingKey || undefined)) {
      setFormError('This command is already in use')
      return
    }

    if (!formState.description.trim()) {
      setFormError('Description is required')
      return
    }

    if (!formState.soql.trim()) {
      setFormError('SOQL query is required')
      return
    }

    if (!formState.soql.toLowerCase().includes('{query}')) {
      setFormError('SOQL must contain {query} placeholder')
      return
    }

    if (!formState.nameField.trim()) {
      setFormError('Name field is required')
      return
    }

    const newCommands = { ...customCommands }

    if (editingKey && editingKey !== formState.key.toLowerCase()) {
      delete newCommands[editingKey]
    }

    const key = formState.key.toLowerCase()
    const descFields = formState.descriptionFields
      .split(',')
      .map(f => f.trim())
      .filter(f => f)
    newCommands[key] = {
      key,
      description: formState.description,
      soql: formState.soql,
      useToolingApi: formState.useToolingApi,
      isBuiltin: false,
      nameField: formState.nameField.trim(),
      descriptionFields: descFields.length > 0 ? descFields : undefined
    }

    onCustomCommandsChange(newCommands)
    resetForm()
  }

  const handleDeleteCommand = (key: string) => {
    if (!confirm(`Delete command ":${key}"?`)) {
      return
    }
    const newCommands = { ...customCommands }
    delete newCommands[key]
    onCustomCommandsChange(newCommands)
  }

  const resetForm = () => {
    setEditingKey(null)
    setIsAddingNew(false)
    setFormState({
      key: '',
      description: '',
      soql: '',
      useToolingApi: false,
      nameField: 'Name',
      descriptionFields: ''
    })
    setFormError(null)
  }

  const handleExportCommands = () => {
    if (Object.keys(customCommands).length === 0) {
      return
    }
    // Export without isBuiltin and key properties (key is the object key)
    const exportData: Record<string, Omit<CustomCommand, 'isBuiltin' | 'key'>> = {}
    for (const [cmdKey, cmd] of Object.entries(customCommands)) {
      exportData[cmdKey] = {
        description: cmd.description,
        soql: cmd.soql,
        useToolingApi: cmd.useToolingApi,
        nameField: cmd.nameField,
        ...(cmd.descriptionFields && cmd.descriptionFields.length > 0
          ? { descriptionFields: cmd.descriptionFields }
          : {})
      }
    }
    const dataStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ultraforce-commands-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportCommands = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const imported = JSON.parse(text) as Record<string, Partial<CustomCommand>>
        // Validate structure (key comes from object key, not cmd.key)
        const validCommands: Record<string, CustomCommand> = {}
        for (const [key, cmd] of Object.entries(imported)) {
          if (cmd && typeof cmd === 'object' && cmd.soql && cmd.nameField) {
            validCommands[key] = {
              key,
              description: cmd.description || '',
              soql: cmd.soql,
              useToolingApi: cmd.useToolingApi || false,
              nameField: cmd.nameField,
              descriptionFields: cmd.descriptionFields
            }
          }
        }
        if (Object.keys(validCommands).length === 0) {
          alert('No valid commands found in file')
          return
        }
        const merged = { ...customCommands, ...validCommands }
        onCustomCommandsChange(merged)
        alert(`Imported ${Object.keys(validCommands).length} command(s)`)
      } catch {
        alert('Failed to parse file. Please ensure it is a valid JSON file.')
      }
    }
    input.click()
  }

  const startAddNew = () => {
    setIsAddingNew(true)
    setEditingKey(null)
    setFormState({
      key: '',
      description: '',
      soql: "SELECT Id, Name FROM MyObject__c WHERE Name LIKE '%{query}%' ORDER BY Name LIMIT 50",
      useToolingApi: false,
      nameField: 'Name',
      descriptionFields: ''
    })
    setFormError(null)
  }

  const renderCommandForm = () => (
    <div className="command-edit-form">
      <div className="command-form-row">
        <label className="command-form-label">Command</label>
        <input
          type="text"
          value={formState.key}
          onChange={(e) => setFormState({ ...formState, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
          placeholder="e.g. log"
          className="command-input"
          maxLength={10}
        />
      </div>
      <div className="command-form-row">
        <label className="command-form-label">Description</label>
        <input
          type="text"
          value={formState.description}
          onChange={(e) => setFormState({ ...formState, description: e.target.value })}
          placeholder="e.g. My Logs"
          className="command-input"
        />
      </div>
      <div className="command-form-row">
        <label className="command-form-label">SOQL Query</label>
        <textarea
          value={formState.soql}
          onChange={(e) => setFormState({ ...formState, soql: e.target.value })}
          placeholder="SELECT Id, Name FROM ... WHERE Name LIKE '%{query}%'"
          className="command-textarea"
          rows={3}
        />
        <span className="command-form-hint">Use {'{query}'} as search placeholder</span>
      </div>
      <div className="command-form-row-inline">
        <div className="command-form-row">
          <label className="command-form-label">Name Field</label>
          <input
            type="text"
            value={formState.nameField}
            onChange={(e) => setFormState({ ...formState, nameField: e.target.value })}
            placeholder="Name"
            className="command-input"
          />
        </div>
        <div className="command-form-row">
          <label className="command-form-label">Description Fields</label>
          <input
            type="text"
            value={formState.descriptionFields}
            onChange={(e) => setFormState({ ...formState, descriptionFields: e.target.value })}
            placeholder="Field1, Field2"
            className="command-input"
          />
        </div>
      </div>
      <span className="command-form-hint">Supports relationship fields (e.g., Owner.Name). Multiple fields separated by comma.</span>
      <div className="command-form-row">
        <label className="command-toggle-option">
          <input
            type="checkbox"
            checked={formState.useToolingApi}
            onChange={(e) => setFormState({ ...formState, useToolingApi: e.target.checked })}
          />
          <span>Use Tooling API</span>
        </label>
      </div>
      {formError && <div className="command-form-error">{formError}</div>}
      <div className="command-edit-actions">
        <button className="cmd-btn cmd-btn-save" onClick={handleSaveCommand}>Save</button>
        <button className="cmd-btn cmd-btn-cancel" onClick={resetForm}>Cancel</button>
      </div>
    </div>
  )

  return (
    <>
      <div className="settings-header">
        <button className="back-button" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H6m0 0l6 6m-6-6l6-6" />
          </svg>
        </button>
        <h2 className="settings-title">Settings</h2>
      </div>

      <div className="settings-content">
        <div className="setting-section">
          <h3 className="section-title">Search Types</h3>
          <p className="section-desc">Select metadata types to include in search.</p>
          <div className="type-grid">
            {METADATA_TYPES.map((type) => {
              const types = type.value.split(',')
              const isChecked = types.every((t) => selectedTypes.includes(t))
              const handleToggle = () => {
                types.forEach((t) => {
                  const isCurrentlySelected = selectedTypes.includes(t)
                  if (isChecked && isCurrentlySelected) {
                    onToggleType(t)
                  } else if (!isChecked && !isCurrentlySelected) {
                    onToggleType(t)
                  }
                })
              }
              return (
                <label key={type.value} className="type-option">
                  <input type="checkbox" checked={isChecked} onChange={handleToggle} className="type-checkbox" />
                  <span className="type-label">{type.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Keyboard Shortcut</h3>
          <p className="section-desc">
            You can set a custom keyboard shortcut for UltraForce in Chrome Extension Keyboard Shortcuts (default: <strong>Ctrl/Cmd + B</strong>).
            <br />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
              Customize at chrome://extensions/shortcuts
            </span>
          </p>
          <div className="shortcut-config">
            <div className="shortcut-display">
              {shortcutKey === 'escape' ? (
                <span>ESC</span>
              ) : shortcutKey.startsWith('alt+') ? (
                <>
                  <span>Alt</span>
                  <span>+</span>
                </>
              ) : (
                <>
                  <span>Cmd/Ctrl</span>
                  <span>+</span>
                </>
              )}
              <select value={shortcutKey} onChange={(e) => onShortcutChange(e.target.value)} className="shortcut-key-select">
                <option value="escape">ESC</option>
                <optgroup label="Ctrl/Cmd +">
                  <option value="b">B</option>
                  <option value="i">I</option>
                  <option value="m">M</option>
                </optgroup>
                <optgroup label="Alt +">
                  <option value="alt+b">B</option>
                  <option value="alt+i">I</option>
                  <option value="alt+m">M</option>
                  <option value="alt+s">S</option>
                  <option value="alt+z">Z</option>
                </optgroup>
              </select>
            </div>
          </div>
          <p className="section-hint" style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            This shortcut may not work on some pages (e.g. Visualforce, iframes).
            Use the global shortcut for reliable access.
          </p>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Behavior</h3>
          <label className="toggle-option">
            <input type="checkbox" checked={closeOnNavigate} onChange={(e) => onCloseOnNavigateChange(e.target.checked)} className="toggle-checkbox" />
            <span className="toggle-label">Close modal after opening result</span>
          </label>
          <label className="toggle-option">
            <input type="checkbox" checked={autoLoadFields} onChange={(e) => onAutoLoadFieldsChange(e.target.checked)} className="toggle-checkbox" />
            <span className="toggle-label">Auto-load all fields on Setup pages</span>
          </label>
          <label className="toggle-option">
            <input type="checkbox" checked={fuzzySearch} onChange={(e) => onFuzzySearchChange(e.target.checked)} className="toggle-checkbox" />
            <span className="toggle-label">Fuzzy search (typo-tolerant matching)</span>
          </label>
          <label className="toggle-option">
            <input type="checkbox" checked={hideManagedPackage} onChange={(e) => onHideManagedPackageChange(e.target.checked)} className="toggle-checkbox" />
            <span className="toggle-label">Hide managed package items</span>
          </label>
          <div className="toggle-option">
            <span className="toggle-label">Max results per type</span>
            <select
              value={maxResultsPerType}
              onChange={(e) => onMaxResultsPerTypeChange(Number(e.target.value))}
              className="shortcut-key-select"
              style={{ marginLeft: 'auto', width: 'auto' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Navigation Mode</h3>
          <p className="section-desc">Choose how to open Salesforce pages.</p>
          <div className="type-grid">
            {NAVIGATION_MODES.map((mode) => (
              <label key={mode.value} className="type-option">
                <input type="radio" name="navigationMode" checked={navigationMode === mode.value} onChange={() => onNavigationModeChange(mode.value as NavigationMode)} className="type-checkbox" />
                <span className="type-label">{mode.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Built-in Commands</h3>
          <p className="section-desc">Type : followed by a command to filter search.</p>
          <div className="commands-list">
            {Object.values(BUILTIN_COMMANDS).map((cmd) => (
              <div key={cmd.key} className="command-row command-row-builtin">
                <span className="command-key">:{cmd.key}</span>
                <span className="command-desc">{cmd.description}</span>
                <span className="command-lock">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Custom Commands</h3>
          <p className="section-desc">Create your own commands with custom SOQL queries.</p>
          <div className="commands-list">
            {Object.values(customCommands).map((cmd) => (
              <div key={cmd.key} className="command-row">
                {editingKey === cmd.key ? (
                  renderCommandForm()
                ) : (
                  <>
                    <span className="command-key">:{cmd.key}</span>
                    <div className="command-info">
                      <span className="command-desc">{cmd.description}</span>
                      <span className="command-api-tag">{cmd.useToolingApi ? 'Tooling' : 'REST'}</span>
                    </div>
                    <div className="command-actions">
                      <button className="cmd-icon-btn" onClick={() => handleEditCommand(cmd)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="cmd-icon-btn cmd-icon-btn-danger" onClick={() => handleDeleteCommand(cmd.key)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {isAddingNew && (
              <div className="command-row">
                {renderCommandForm()}
              </div>
            )}

            {Object.keys(customCommands).length === 0 && !isAddingNew && (
              <div className="commands-empty">No custom commands yet</div>
            )}
          </div>
          {!isAddingNew && !editingKey && (
            <div className="commands-footer">
              <button className="cmd-btn cmd-btn-add" onClick={startAddNew}>+ Add Command</button>
              <div className="commands-footer-right">
                <button
                  className="cmd-btn cmd-btn-secondary"
                  onClick={handleImportCommands}
                  title="Import commands from JSON file"
                >
                  Import
                </button>
                <button
                  className="cmd-btn cmd-btn-secondary"
                  onClick={handleExportCommands}
                  disabled={Object.keys(customCommands).length === 0}
                  title="Export commands to JSON file"
                >
                  Export
                </button>
              </div>
            </div>
          )}
        </div>

        {sfHost && (
          <div className="setting-section">
            <h3 className="section-title">Organization</h3>
            <div className="shortcut-config">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ color: '#fff', fontWeight: 500 }}>{displayName}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{sfHost}</div>
              </div>
            </div>
          </div>
        )}

        <div className="settings-meta">
          <span className="meta-item">UltraForce v{getAppVersion()}</span>
          <a
            className="meta-link"
            href={PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
          >
            Privacy
          </a>
        </div>
      </div>
    </>
  )
}

export default SettingsPanel
export type { NavigationMode }
