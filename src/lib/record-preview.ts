/**
 * Record Preview Service
 *
 * Resolves Salesforce record IDs to their object type and display name
 * via REST API. Two-layer cache:
 *   1. Key prefix -> object type (stable, rarely changes)
 *   2. Record ID -> preview data (5-min TTL, max 50 entries)
 */

import { sfRest, API_VERSION } from '~lib/auth'
import type { SfRestError } from '~lib/auth'
import { getKeyPrefix } from '~lib/id-utils'
import { logger } from '~lib/logger'

export interface RecordPreview {
  id: string
  objectType: string
  name: string
  fetchedAt: number
}

const PREVIEW_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_PREVIEW_CACHE = 50

// Key prefix (3 chars) -> object API name
const keyPrefixCache = new Map<string, string>()

// Record ID -> preview
const previewCache = new Map<string, RecordPreview>()

interface SObjectDescribe {
  name: string
  keyPrefix: string | null
}

interface GlobalDescribeResponse {
  sobjects: SObjectDescribe[]
}

/**
 * Resolves a 3-character key prefix to a Salesforce object API name.
 * Fetches and caches the global describe on first call.
 */
export async function resolveObjectType(
  sfHost: string,
  keyPrefix: string,
  signal?: AbortSignal
): Promise<string | null> {
  const cached = keyPrefixCache.get(keyPrefix)
  if (cached) return cached

  try {
    const response = await sfRest<GlobalDescribeResponse>(
      sfHost,
      `/services/data/v${API_VERSION}/sobjects/`,
      { signal }
    )

    if (response?.sobjects) {
      for (const obj of response.sobjects) {
        if (obj.keyPrefix) {
          keyPrefixCache.set(obj.keyPrefix, obj.name)
        }
      }
    }

    return keyPrefixCache.get(keyPrefix) ?? null
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    logger.error('Failed to resolve object type', { keyPrefix, error })
    return null
  }
}

/**
 * Fetches a record preview (object type + display name) for a Salesforce ID.
 * Returns cached data when fresh. Handles 404/403 gracefully.
 */
export async function fetchRecordPreview(
  sfHost: string,
  recordId: string,
  signal?: AbortSignal
): Promise<RecordPreview | null> {
  // Check cache
  const cached = previewCache.get(recordId)
  if (cached && Date.now() - cached.fetchedAt < PREVIEW_TTL_MS) {
    return cached
  }

  const prefix = getKeyPrefix(recordId)

  try {
    const objectType = await resolveObjectType(sfHost, prefix, signal)
    if (!objectType) {
      return makePreview(recordId, 'Unknown', 'Unknown object type')
    }

    const record = await sfRest<Record<string, unknown>>(
      sfHost,
      `/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}?fields=Name`,
      { signal }
    )

    const name = extractDisplayName(record)
    return cachePreview(makePreview(recordId, objectType, name))
  } catch (error) {
    if ((error as Error).name === 'AbortError') return null

    const status = (error as SfRestError).status
    if (status === 404) {
      return cachePreview(makePreview(recordId, 'Unknown', 'Record not found'))
    }
    if (status === 403) {
      return cachePreview(makePreview(recordId, 'Unknown', 'No access'))
    }

    logger.error('Failed to fetch record preview', { recordId, error })
    return null
  }
}

/**
 * Clears both key prefix and record preview caches. Used for testing.
 */
export function clearPreviewCache(): void {
  keyPrefixCache.clear()
  previewCache.clear()
}

// --- Internals ---

function makePreview(id: string, objectType: string, name: string): RecordPreview {
  return { id, objectType, name, fetchedAt: Date.now() }
}

function cachePreview(preview: RecordPreview): RecordPreview {
  // LRU eviction: remove oldest entry if at capacity
  if (previewCache.size >= MAX_PREVIEW_CACHE) {
    const oldestKey = previewCache.keys().next().value
    if (oldestKey) previewCache.delete(oldestKey)
  }
  previewCache.set(preview.id, preview)
  return preview
}

function extractDisplayName(record: Record<string, unknown>): string {
  // Most objects use Name; some use Subject, Title, or DeveloperName
  for (const field of ['Name', 'Subject', 'Title', 'DeveloperName']) {
    if (typeof record[field] === 'string' && record[field]) {
      return record[field] as string
    }
  }
  return record.Id ? String(record.Id) : 'Unnamed'
}
