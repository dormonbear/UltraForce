/**
 * UltraForce Authentication Module
 * Based on Salesforce-Inspector-reloaded approach
 * Uses browser session cookie (sid) for authentication
 */

import { trackApiRequest } from './api-stats'
import { normalizeHost } from './domain-utils'
import { logger } from './logger'

export const API_VERSION = '62.0'

export interface SfSession {
  key: string
  hostname: string
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
    logger.error('Failed to get SF host:', error)
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
    logger.error('Failed to get session:', error)
    return null
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
