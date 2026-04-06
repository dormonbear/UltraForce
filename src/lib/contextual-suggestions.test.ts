import { describe, it, expect } from 'vitest'
import {
  getRecordSuggestions,
  getSetupSuggestions,
  isSetupPage
} from './contextual-suggestions'
import type { SetupShortcut } from './setup-shortcuts'

const TEST_HOST = 'myorg.lightning.force.com'

describe('getRecordSuggestions', () => {
  const baseContext = {
    objectApiName: 'Account',
    recordId: '001000000000001AAA',
    recordTypeId: null
  }

  it('returns 2 actions for a standard object record', () => {
    const actions = getRecordSuggestions(baseContext, TEST_HOST)
    expect(actions).toHaveLength(2)
  })

  it('includes Clone and Object Setup', () => {
    const actions = getRecordSuggestions(baseContext, TEST_HOST)
    const ids = actions.map((a) => a.id)
    expect(ids).toContain('clone-record')
    expect(ids).toContain('object-setup')
  })

  it('builds Object Manager Details URL for standard objects', () => {
    const actions = getRecordSuggestions(baseContext, TEST_HOST)
    const setup = actions.find((a) => a.id === 'object-setup')
    expect(setup?.url).toContain('ObjectManager/Account/Details')
  })

  it('builds Object Manager Details URL for custom objects', () => {
    const context = { ...baseContext, objectApiName: 'My_Custom__c' }
    const actions = getRecordSuggestions(context, TEST_HOST)
    const setup = actions.find((a) => a.id === 'object-setup')
    expect(setup?.url).toContain('ObjectManager/My_Custom__c/Details')
  })

  it('returns empty array when objectApiName is null', () => {
    const context = { ...baseContext, objectApiName: null }
    const actions = getRecordSuggestions(context, TEST_HOST)
    expect(actions).toEqual([])
  })

  it('returns empty array when sfHost is empty', () => {
    const actions = getRecordSuggestions(baseContext, '')
    expect(actions).toEqual([])
  })

  it('each action has id, name, description, icon, and url', () => {
    const actions = getRecordSuggestions(baseContext, TEST_HOST)
    for (const action of actions) {
      expect(action.id).toBeTruthy()
      expect(action.name).toBeTruthy()
      expect(action.description).toBeTruthy()
      expect(action.icon).toBeTruthy()
      expect(action.url).toMatch(/^https:\/\//)
    }
  })
})

describe('getSetupSuggestions', () => {
  const shortcuts: SetupShortcut[] = [
    { id: 'flows', name: 'Flows', description: 'Process Automation', path: '/lightning/setup/Flows/home' },
    { id: 'workflow-rules', name: 'Workflow Rules', description: 'Process Automation', path: '/lightning/setup/WorkflowRules/home' },
    { id: 'approval-processes', name: 'Approval Processes', description: 'Process Automation', path: '/lightning/setup/ApprovalProcesses/home' },
    { id: 'users', name: 'Users', description: 'User Management', path: '/lightning/setup/ManageUsers/home' },
    { id: 'profiles', name: 'Profiles', description: 'User Management', path: '/lightning/setup/EnhancedProfiles/home' }
  ]

  it('returns related shortcuts in the same category', () => {
    const suggestions = getSetupSuggestions('/lightning/setup/Flows/home', shortcuts)
    expect(suggestions).toHaveLength(2) // workflow-rules and approval-processes
    const ids = suggestions.map((s) => s.id)
    expect(ids).toContain('workflow-rules')
    expect(ids).toContain('approval-processes')
  })

  it('excludes the current shortcut from suggestions', () => {
    const suggestions = getSetupSuggestions('/lightning/setup/Flows/home', shortcuts)
    const ids = suggestions.map((s) => s.id)
    expect(ids).not.toContain('flows')
  })

  it('returns empty array when URL does not match any shortcut', () => {
    const suggestions = getSetupSuggestions('/lightning/setup/UnknownPage/home', shortcuts)
    expect(suggestions).toEqual([])
  })

  it('returns empty array for empty path', () => {
    const suggestions = getSetupSuggestions('', shortcuts)
    expect(suggestions).toEqual([])
  })

  it('limits results to 5', () => {
    const manyShortcuts: SetupShortcut[] = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      description: 'Same Category',
      path: `/lightning/setup/Item${i}/home`
    }))

    const suggestions = getSetupSuggestions('/lightning/setup/Item0/home', manyShortcuts)
    expect(suggestions.length).toBeLessThanOrEqual(5)
  })
})

describe('isSetupPage', () => {
  it('returns true for Lightning setup URL', () => {
    expect(isSetupPage('/lightning/setup/ManageUsers/home')).toBe(true)
  })

  it('returns true for Classic setup URL', () => {
    expect(isSetupPage('/_ui/common/setup/entity/something')).toBe(true)
  })

  it('returns false for record page', () => {
    expect(isSetupPage('/lightning/r/Account/001xxx/view')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSetupPage('')).toBe(false)
  })
})
