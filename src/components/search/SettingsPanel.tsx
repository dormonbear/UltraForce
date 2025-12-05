import React from 'react'

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
  navigationMode: NavigationMode
  onNavigationModeChange: (mode: NavigationMode) => void
  sfHost: string | null
}

const METADATA_TYPES = [
  { value: 'ApexClass', label: 'Apex Classes' },
  { value: 'ApexTrigger', label: 'Apex Triggers' },
  { value: 'CustomObject', label: 'Custom Objects' },
  { value: 'CustomField', label: 'Fields (Object.Field)' },
  { value: 'Flow', label: 'Flows' },
  { value: 'PermissionSet', label: 'Permission Sets' },
  { value: 'Profile', label: 'Profiles' }
]

const NAVIGATION_MODES = [
  { value: 'auto', label: 'Auto (Follow User)' },
  { value: 'lightning', label: 'Lightning Experience' },
  { value: 'classic', label: 'Salesforce Classic' }
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
  sfHost
}) => {
  const displayName = sfHost ? sfHost.split('.')[0] : null

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
            {METADATA_TYPES.map((type) => (
              <label key={type.value} className="type-option">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.value)}
                  onChange={() => onToggleType(type.value)}
                  className="type-checkbox"
                />
                <span className="type-label">{type.label}</span>
              </label>
            ))}
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
