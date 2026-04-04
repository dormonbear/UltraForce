import { describe, it, expect } from 'vitest'
import { SETUP_SHORTCUTS } from './setup-shortcuts'
import type { SetupShortcut } from './setup-shortcuts'

describe('setup-shortcuts', () => {
  it('should export SETUP_SHORTCUTS as non-empty array', () => {
    expect(Array.isArray(SETUP_SHORTCUTS)).toBe(true)
    expect(SETUP_SHORTCUTS.length).toBeGreaterThan(0)
  })

  it('should have required fields on each shortcut', () => {
    for (const shortcut of SETUP_SHORTCUTS) {
      expect(shortcut).toHaveProperty('id')
      expect(shortcut).toHaveProperty('name')
      expect(shortcut).toHaveProperty('description')
      expect(shortcut).toHaveProperty('path')
      expect(typeof shortcut.id).toBe('string')
      expect(typeof shortcut.name).toBe('string')
      expect(typeof shortcut.description).toBe('string')
      expect(typeof shortcut.path).toBe('string')
    }
  })

  it('should have unique IDs', () => {
    const ids = SETUP_SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should export SetupShortcut type', () => {
    // Type check - if this compiles, the type is exported
    const shortcut: SetupShortcut = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      path: '/test'
    }
    expect(shortcut.id).toBe('test')
  })

  it('should have classicPath as optional string', () => {
    const withClassic = SETUP_SHORTCUTS.filter((s) => s.classicPath)
    const withoutClassic = SETUP_SHORTCUTS.filter((s) => !s.classicPath)
    expect(withClassic.length).toBeGreaterThan(0)
    expect(withoutClassic.length).toBeGreaterThan(0)
  })
})
