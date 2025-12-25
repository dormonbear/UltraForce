/**
 * UltraForce Authentication Module
 * Based on Salesforce-Inspector-reloaded approach
 * Uses browser session cookie (sid) for authentication
 */

import type { Organization } from '~types'
import { trackApiRequest } from './api-stats'

export const API_VERSION = '62.0'

export interface SfSession {
  key: string
  hostname: string
}

export interface SessionInfo {
  sessionId: string
  hostname: string
  orgId: string
  isSandbox: boolean
}

function normalizeHost(host: string): string {
  if (!host) return host
  let normalized = host.replace(/^\./, '')

  normalized = normalized.replace(/\.lightning\.force\./, '.my.salesforce.')

  // China: .sandbox.setup. -> .sandbox.my., .setup. -> .my.
  normalized = normalized.replace(/\.sandbox\.(setup|lightning|file|content|c)\.sfcrmproducts\./, '.sandbox.my.sfcrmproducts.')
  normalized = normalized.replace(/\.sandbox\.(setup|lightning|file|content|c)\.sfcrmapps\./, '.sandbox.my.sfcrmapps.')
  normalized = normalized.replace(/\.(lightning|file|content|c|setup)\.sfcrmproducts\./, '.my.sfcrmproducts.')
  normalized = normalized.replace(/\.(lightning|file|content|c|setup)\.sfcrmapps\./, '.my.sfcrmapps.')

  normalized = normalized.replace(/\.mcas\.ms$/, '')

  return normalized
}

/**
 * Get Salesforce host from background script
 * This retrieves the appropriate SF domain by checking cookies
 */
export async function getSfHost(url: string): Promise<string | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      message: 'getSfHost',
      url
    })
    return response || null
  } catch (error) {
    console.error('Failed to get SF host:', error)
    return null
  }
}

/**
 * Get session from background script
 * Retrieves the sid cookie value for the given Salesforce host
 * Note: Don't normalize host for cookie lookup - cookie is on original domain
 */
export async function getSession(sfHost: string): Promise<SfSession | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      message: 'getSession',
      sfHost: sfHost
    })
    return response || null
  } catch (error) {
    console.error('Failed to get session:', error)
    return null
  }
}

/**
 * Get session info including org details
 */
export async function getSessionInfo(sfHost: string): Promise<SessionInfo | null> {
  const session = await getSession(sfHost)
  if (!session) return null

  const orgId = session.key.split('!')[0]
  const hostname = normalizeHost(session.hostname)

  const isSandbox = hostname.includes('sandbox') ||
                    hostname.includes('test') ||
                    hostname.includes('scratch') ||
                    hostname.includes('--')

  return {
    sessionId: session.key,
    hostname,
    orgId,
    isSandbox
  }
}

/**
 * Check if user is logged into Salesforce on current page
 */
export async function isLoggedIn(url: string): Promise<boolean> {
  const sfHost = await getSfHost(url)
  if (!sfHost) return false

  const session = await getSession(sfHost)
  return session !== null && session.key !== null
}

/**
 * Get organization info from current session
 */
export async function getCurrentOrganization(url: string): Promise<Organization | null> {
  const sfHost = await getSfHost(url)
  if (!sfHost) return null

  const sessionInfo = await getSessionInfo(sfHost)
  if (!sessionInfo) return null

  return {
    id: sessionInfo.orgId,
    name: sfHost.split('.')[0],
    username: '',
    email: '',
    domain: `https://${sessionInfo.hostname}`,
    orgType: sessionInfo.isSandbox ? 'Sandbox' : 'Production',
    sessionId: sessionInfo.sessionId
  }
}

/**
 * Make authenticated REST API call to Salesforce
 */
export async function sfRest(
  sfHost: string,
  path: string,
  options: {
    method?: string
    body?: any
    api?: 'normal' | 'bulk'
  } = {}
): Promise<any> {
  const { method = 'GET', body, api = 'normal' } = options

  const session = await getSession(sfHost)
  if (!session) {
    throw new Error('No valid session found. Please log in to Salesforce.')
  }

  const hostname = normalizeHost(session.hostname)
  const url = `https://${hostname}${path}`

  const headers: Record<string, string> = {
    Accept: 'application/json; charset=UTF-8'
  }

  if (api === 'bulk') {
    headers['X-SFDC-Session'] = session.key
  } else {
    headers['Authorization'] = `Bearer ${session.key}`
  }

  if (body) {
    headers['Content-Type'] = 'application/json; charset=UTF-8'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const errorText = await response.text()
    trackApiRequest()

    if (response.status === 401) {
      throw new Error('Session expired. Please refresh the page and try again.')
    }

    throw new Error(`API Error ${response.status}: ${errorText}`)
  }

  trackApiRequest()
  return response.json()
}

/**
 * Validate current session by making a test API call
 */
export async function validateSession(sfHost: string): Promise<boolean> {
  try {
    await sfRest(sfHost, `/services/data/v${API_VERSION}/sobjects/`)
    return true
  } catch (error) {
    console.warn('Session validation failed:', error)
    return false
  }
}

/**
 * Get org info from API
 */
export async function getOrgInfo(sfHost: string): Promise<{
  isSandbox: boolean
  instanceName: string
  trialExpirationDate: string | null
} | null> {
  try {
    const result = await sfRest(
      sfHost,
      `/services/data/v${API_VERSION}/query/?q=SELECT+IsSandbox,+InstanceName,+TrialExpirationDate+FROM+Organization`
    )

    if (result.records && result.records.length > 0) {
      return {
        isSandbox: result.records[0].IsSandbox,
        instanceName: result.records[0].InstanceName,
        trialExpirationDate: result.records[0].TrialExpirationDate
      }
    }
    return null
  } catch (error) {
    console.error('Failed to get org info:', error)
    return null
  }
}

// Export for backwards compatibility
export const auth = {
  getSession,
  getSfHost,
  API_VERSION
}

export default auth
