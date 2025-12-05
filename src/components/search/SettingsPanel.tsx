import React, { useState } from 'react'
import type { SearchCommand } from '~types'
import { DEFAULT_COMMANDS } from '~lib/command-parser'

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
  navigationMode: NavigationMode
  onNavigationModeChange: (mode: NavigationMode) => void
  sfHost: string | null
  commands: Record<string, SearchCommand>
  onCommandsChange: (commands: Record<string, SearchCommand>) => void
}

const METADATA_TYPES = [
  { value: 'ApexClass,ApexTrigger', label: 'Apex Classes & Triggers' },
  { value: 'CustomObject,CustomField', label: 'Objects & Fields' },
  { value: 'Flow', label: 'Flows' },
  { value: 'CustomLabel', label: 'Custom Labels' },
  { value: 'CustomMetadataType', label: 'Custom Metadata Types' },
  { value: 'CustomSetting', label: 'Custom Settings' },
  { value: 'PermissionSet', label: 'Permission Sets' },
  { value: 'Profile', label: 'Profiles' }
]

const NAVIGATION_MODES = [
  { value: 'auto', label: 'Auto (Follow User)' },
  { value: 'lightning', label: 'Lightning Experience' },
  { value: 'classic', label: 'Salesforce Classic' }
]

const ALL_TYPES = [
  { value: 'ApexClass', label: 'ApexClass' },
  { value: 'ApexTrigger', label: 'ApexTrigger' },
  { value: 'CustomObject', label: 'CustomObject' },
  { value: 'CustomField', label: 'CustomField' },
  { value: 'Flow', label: 'Flow' },
  { value: 'User', label: 'User' },
  { value: 'PermissionSet', label: 'PermissionSet' },
  { value: 'Profile', label: 'Profile' },
  { value: 'CustomLabel', label: 'CustomLabel' },
  { value: 'CustomMetadataType', label: 'CustomMetadataType' },
  { value: 'CustomSetting', label: 'CustomSetting' }
]

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
  navigationMode,
  onNavigationModeChange,
  sfHost,
  commands,
  onCommandsChange,
  hideManagedPackage,
  onHideManagedPackageChange
}) => {
  const displayName = sfHost ? sfHost.split('.')[0] : null
  const [editingCommand, setEditingCommand] = useState<string | null>(null)
  const [newCommandKey, setNewCommandKey] = useState('')
  const [newCommandTypes, setNewCommandTypes] = useState<string[]>([])
  const [isAddingNew, setIsAddingNew] = useState(false)

  const handleEditCommand = (cmd: SearchCommand) => {
    setEditingCommand(cmd.key)
    setNewCommandKey(cmd.key)
    setNewCommandTypes([...cmd.types])
  }

  const isKeyDuplicate = (key: string) => {
    if (!key) return false
    if (editingCommand === key) return false
    return key in commands
  }

  const handleSaveCommand = () => {
    if (!newCommandKey.trim() || newCommandTypes.length === 0) return
    if (isKeyDuplicate(newCommandKey)) return

    const newCommands = { ...commands }
    if (editingCommand && editingCommand !== newCommandKey) {
      delete newCommands[editingCommand]
    }
    newCommands[newCommandKey] = {
      key: newCommandKey,
      description: newCommandTypes.join(', '),
      types: newCommandTypes
    }
    onCommandsChange(newCommands)
    resetForm()
  }

  const handleDeleteCommand = (key: string) => {
    const newCommands = { ...commands }
    delete newCommands[key]
    onCommandsChange(newCommands)
  }

  const handleResetCommands = () => {
    onCommandsChange({ ...DEFAULT_COMMANDS })
  }

  const resetForm = () => {
    setEditingCommand(null)
    setIsAddingNew(false)
    setNewCommandKey('')
    setNewCommandTypes([])
  }

  const toggleType = (type: string) => {
    setNewCommandTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const startAddNew = () => {
    setIsAddingNew(true)
    setEditingCommand(null)
    setNewCommandKey('')
    setNewCommandTypes([])
  }

  return (
    <>
      <div className="settings-header">
        <button className="back-button" onClick={onClose}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleToggle}
                    className="type-checkbox"
                  />
                  <span className="type-label">{type.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Keyboard Shortcut</h3>
          <div className="shortcut-config">
            <div className="shortcut-display">
              <span>Cmd/Ctrl</span>
              <span>+</span>
              <select
                value={shortcutKey}
                onChange={(e) => onShortcutChange(e.target.value)}
                className="shortcut-key-select"
              >
                {Array.from('abcdefghijklmnopqrstuvwxyz').map((letter) => (
                  <option key={letter} value={letter}>
                    {letter.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Behavior</h3>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={closeOnNavigate}
              onChange={(e) => onCloseOnNavigateChange(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-label">Close modal after opening result</span>
          </label>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={autoLoadFields}
              onChange={(e) => onAutoLoadFieldsChange(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-label">Auto-load all fields on Setup pages</span>
          </label>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={fuzzySearch}
              onChange={(e) => onFuzzySearchChange(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-label">Fuzzy search (typo-tolerant matching)</span>
          </label>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={hideManagedPackage}
              onChange={(e) => onHideManagedPackageChange(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-label">Hide managed package items</span>
          </label>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Navigation Mode</h3>
          <p className="section-desc">Choose how to open Salesforce pages.</p>
          <div className="type-grid">
            {NAVIGATION_MODES.map((mode) => (
              <label key={mode.value} className="type-option">
                <input
                  type="radio"
                  name="navigationMode"
                  checked={navigationMode === mode.value}
                  onChange={() => onNavigationModeChange(mode.value as NavigationMode)}
                  className="type-checkbox"
                />
                <span className="type-label">{mode.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">Commands</h3>
          <p className="section-desc">Type : followed by a command to filter search.</p>
          <div className="commands-list">
            {Object.values(commands).map((cmd) => (
              <div key={cmd.key} className="command-row">
                {editingCommand === cmd.key ? (
                  <div className="command-edit-form">
                    <div className="command-edit-row">
                      <input
                        type="text"
                        value={newCommandKey}
                        onChange={(e) => setNewCommandKey(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                        placeholder="key"
                        className={`command-input command-input-key ${isKeyDuplicate(newCommandKey) ? 'input-error' : ''}`}
                        maxLength={2}
                      />
                    </div>
                    <div className="command-types-select">
                      {ALL_TYPES.map((t) => (
                        <label key={t.value} className="command-type-option">
                          <input
                            type="checkbox"
                            checked={newCommandTypes.includes(t.value)}
                            onChange={() => toggleType(t.value)}
                          />
                          <span>{t.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="command-edit-actions">
                      <button className="cmd-btn cmd-btn-save" onClick={handleSaveCommand}>Save</button>
                      <button className="cmd-btn cmd-btn-cancel" onClick={resetForm}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="command-key">:{cmd.key}</span>
                    <div className="command-types-display">
                      {cmd.types.map((type) => (
                        <span key={type} className="command-type-tag">{type}</span>
                      ))}
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
                <div className="command-edit-form">
                  <div className="command-edit-row">
                    <input
                      type="text"
                      value={newCommandKey}
                      onChange={(e) => setNewCommandKey(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                      placeholder="key"
                      className={`command-input command-input-key ${isKeyDuplicate(newCommandKey) ? 'input-error' : ''}`}
                      maxLength={2}
                    />
                  </div>
                  <div className="command-types-select">
                    {ALL_TYPES.map((t) => (
                      <label key={t.value} className="command-type-option">
                        <input
                          type="checkbox"
                          checked={newCommandTypes.includes(t.value)}
                          onChange={() => toggleType(t.value)}
                        />
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="command-edit-actions">
                    <button className="cmd-btn cmd-btn-save" onClick={handleSaveCommand}>Save</button>
                    <button className="cmd-btn cmd-btn-cancel" onClick={resetForm}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="commands-footer">
            {!isAddingNew && !editingCommand && (
              <button className="cmd-btn cmd-btn-add" onClick={startAddNew}>+ Add Command</button>
            )}
            <button className="cmd-btn cmd-btn-reset" onClick={handleResetCommands}>Reset to Default</button>
          </div>
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
      </div>
    </>
  )
}

export default SettingsPanel
export type { NavigationMode }
