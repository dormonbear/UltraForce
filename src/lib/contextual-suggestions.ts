/**
 * Contextual Suggestions Engine
 *
 * Pure functions that generate page-aware suggestions:
 * 1. Expanded record page actions (View Sharing, Audit History, etc.)
 * 2. Related setup page suggestions based on current setup page category
 *
 * No API calls — all suggestions derived from URL patterns and metadata.
 */

import type { RecordContext } from '~types'
import type { SetupShortcut } from '~lib/setup-shortcuts'

export interface ContextualAction {
  id: string
  name: string
  description: string
  icon: string
  url: string
}

/**
 * Returns expanded record actions for the current record page.
 * Supplements the existing Page Layout / Record Type / Fields actions
 * with URL-navigable shortcuts.
 */
export function getRecordSuggestions(
  recordContext: RecordContext,
  sfHost: string
): ContextualAction[] {
  const { objectApiName, recordId } = recordContext
  if (!objectApiName || !sfHost) return []

  const baseUrl = `https://${sfHost}`
  const actions: ContextualAction[] = []

  // Clone record
  actions.push({
    id: 'clone-record',
    name: 'Clone',
    description: 'Clone this record',
    icon: 'clone',
    url: `${baseUrl}/lightning/o/${objectApiName}/new?defaultFieldValues=&clone=${recordId}`
  })

  // Object setup — go to the object's setup page (Details for all objects)
  actions.push({
    id: 'object-setup',
    name: 'Object Setup',
    description: `Open ${objectApiName} setup`,
    icon: 'setup',
    url: `${baseUrl}/lightning/setup/ObjectManager/${objectApiName}/Details/view`
  })

  return actions
}

const MAX_SETUP_SUGGESTIONS = 5

/**
 * Returns related setup pages based on the current URL.
 * Matches the current page against setup shortcuts to find the category,
 * then returns other pages in the same category.
 */
export function getSetupSuggestions(
  currentPath: string,
  shortcuts: SetupShortcut[]
): SetupShortcut[] {
  if (!currentPath) return []

  // Find which shortcut matches the current page
  const currentShortcut = shortcuts.find((s) => currentPath.includes(s.path))
  if (!currentShortcut) return []

  // Return other shortcuts in the same category
  return shortcuts
    .filter(
      (s) => s.description === currentShortcut.description && s.id !== currentShortcut.id
    )
    .slice(0, MAX_SETUP_SUGGESTIONS)
}

/**
 * Detects if the current URL is a setup page.
 */
export function isSetupPage(pathname: string): boolean {
  return pathname.includes('/lightning/setup/') || pathname.includes('/_ui/common/setup/')
}
