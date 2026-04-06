import type { SetupShortcut } from './setup-shortcuts'
import type { NavigationMode } from '~types'

export function resolveSetupShortcutPath(shortcut: SetupShortcut, sfHost: string | null): string {
  // Alibaba domains use ManageUsersLightning instead of ManageUsers
  if (shortcut.id === 'users' && (sfHost?.includes('sfcrmproducts.cn') || sfHost?.includes('sfcrmapps.cn'))) {
    return '/lightning/setup/ManageUsersLightning/home'
  }
  return shortcut.path
}

export function getSetupHost(sfHost: string | null): string | null {
  if (!sfHost) return null
  return sfHost
    .replace('.my.salesforce.com', '.my.salesforce-setup.com')
    .replace('.lightning.force.com', '.my.salesforce-setup.com')
    .replace('.my.sfcrmproducts.cn', '.setup.sfcrmproducts.cn')
    .replace('.my.sfcrmapps.cn', '.setup.sfcrmapps.cn')
    .replace('.lightning.sfcrmproducts.cn', '.setup.sfcrmproducts.cn')
    .replace('.lightning.sfcrmapps.cn', '.setup.sfcrmapps.cn')
    .replace('.sandbox.my.sfcrmproducts.cn', '.sandbox.setup.sfcrmproducts.cn')
    .replace('.sandbox.my.sfcrmapps.cn', '.sandbox.setup.sfcrmapps.cn')
}

export function buildSetupUrl(sfHost: string | null, path: string): string | null {
  const setupHost = getSetupHost(sfHost)
  if (!setupHost) return null
  return `https://${setupHost}${path}`
}

// Metadata key prefixes that are Setup entities, not data records
const SETUP_ENTITY_PREFIXES = [
  '01I', // CustomObject definition
  '01p', // ApexClass
  '01q', // ApexTrigger
  '066', // ApexPage
  '099', // ApexComponent
  '0Ab', // AuraDefinitionBundle
  '0Rd', // LightningComponentBundle
  '300', // Flow / FlowDefinition
  '0PS'  // PermissionSet
]

export function getCurrentRecordFromUrl(): { objectApiName: string | null; recordId: string | null } {
  const path = window.location.pathname
  const search = window.location.search || ''

  // Skip URLs that are clearly Setup pages
  if (path.includes('/lightning/setup/') || search.includes('setupid=')) {
    return { objectApiName: null, recordId: null }
  }

  const lightningMatch = path.match(/^\/lightning\/r\/([^/]+)\/([A-Za-z0-9]{15,18})(?:\/|$)/)
  if (lightningMatch && lightningMatch[1] && lightningMatch[2]) {
    return { objectApiName: lightningMatch[1], recordId: lightningMatch[2] }
  }

  const classicMatch = path.match(/^\/([A-Za-z0-9]{15,18})(?:\/|$|\?)/)
  if (classicMatch && classicMatch[1]) {
    const id = classicMatch[1]
    const prefix = id.substring(0, 3)
    if (SETUP_ENTITY_PREFIXES.includes(prefix)) {
      return { objectApiName: null, recordId: null }
    }
    return { objectApiName: null, recordId: id }
  }

  return { objectApiName: null, recordId: null }
}

/** Returns true for Alibaba-hosted Salesforce domains (China region). */
export function isChinaDomain(sfHost: string | null): boolean {
  if (!sfHost) return false
  return sfHost.includes('.sfcrmproducts.cn') || sfHost.includes('.sfcrmapps.cn')
}

export function shouldUseLightning(mode: NavigationMode, userPreference: boolean | null = null): boolean {
  if (mode === 'lightning') {
    return true
  }
  if (mode === 'classic') {
    return false
  }

  if (userPreference !== null) {
    return userPreference
  }

  const url = window.location.href
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  if (url.includes('lex=off')) {
    return false
  }
  if (url.includes('/lightning/') || url.includes('/one/one.app')) {
    return true
  }

  if (hostname.includes('.lightning.force.com') ||
      hostname.includes('.salesforce-setup.com') ||
      hostname.includes('.setup.sfcrmproducts.cn') ||
      hostname.includes('.setup.sfcrmapps.cn')) {
    return true
  }

  const classicPatterns = ['/home/home.jsp', '/setup/forcecomHomepage.apexp', '/ui/setup/', '/p/setup/', '/apexpages/', '/_ui/', '/servlet/']
  if (classicPatterns.some((pattern) => pathname.includes(pattern))) {
    return false
  }

  const classicRecordPattern = /^\/[a-zA-Z0-9]{15,18}(\/|$|\?)/
  if (classicRecordPattern.test(pathname) && !pathname.includes('/lightning/')) {
    return false
  }

  return true
}
