import { sfRest, API_VERSION } from './auth'
import type {
  GlobalDescribe,
  GlobalDescribeSObject,
  SObjectDescribe,
  SObjectDescribeField
} from '~types/soql'

const GLOBAL_DESCRIBE_TTL = 5 * 60 * 1000 // 5 minutes
const SOBJECT_DESCRIBE_TTL = 10 * 60 * 1000 // 10 minutes

interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface DescribeCache {
  global: CacheEntry<GlobalDescribe> | null
  sobjects: Map<string, CacheEntry<SObjectDescribe>>
}

const cacheByHost: Map<string, DescribeCache> = new Map()

function getCache(sfHost: string): DescribeCache {
  if (!cacheByHost.has(sfHost)) {
    cacheByHost.set(sfHost, {
      global: null,
      sobjects: new Map()
    })
  }
  return cacheByHost.get(sfHost)!
}

function isCacheValid<T>(entry: CacheEntry<T> | null, ttl: number): boolean {
  if (!entry) return false
  return Date.now() - entry.timestamp < ttl
}

export async function getGlobalDescribe(
  sfHost: string,
  useToolingApi = false
): Promise<GlobalDescribe> {
  const cache = getCache(sfHost)
  const cacheKey = useToolingApi ? 'tooling' : 'data'

  if (isCacheValid(cache.global, GLOBAL_DESCRIBE_TTL)) {
    return cache.global!.data
  }

  const apiPath = useToolingApi
    ? `/services/data/v${API_VERSION}/tooling/sobjects/`
    : `/services/data/v${API_VERSION}/sobjects/`

  const response = await sfRest(sfHost, apiPath)

  const globalDescribe: GlobalDescribe = {
    sobjects: (response.sobjects || []).map((obj: any) => ({
      name: obj.name,
      label: obj.label,
      labelPlural: obj.labelPlural,
      keyPrefix: obj.keyPrefix,
      queryable: obj.queryable,
      searchable: obj.searchable,
      custom: obj.custom
    }))
  }

  cache.global = {
    data: globalDescribe,
    timestamp: Date.now()
  }

  return globalDescribe
}

export async function getSObjectDescribe(
  sfHost: string,
  sobjectName: string,
  useToolingApi = false
): Promise<SObjectDescribe | null> {
  const cache = getCache(sfHost)
  const cacheKey = `${sobjectName.toLowerCase()}_${useToolingApi ? 'tooling' : 'data'}`

  const cached = cache.sobjects.get(cacheKey)
  if (isCacheValid(cached ?? null, SOBJECT_DESCRIBE_TTL)) {
    return cached!.data
  }

  try {
    const apiPath = useToolingApi
      ? `/services/data/v${API_VERSION}/tooling/sobjects/${sobjectName}/describe`
      : `/services/data/v${API_VERSION}/sobjects/${sobjectName}/describe`

    const response = await sfRest(sfHost, apiPath)

    const describe: SObjectDescribe = {
      name: response.name,
      label: response.label,
      labelPlural: response.labelPlural,
      keyPrefix: response.keyPrefix,
      fields: (response.fields || []).map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        referenceTo: field.referenceTo || [],
        relationshipName: field.relationshipName,
        picklistValues: field.picklistValues?.filter((pv: any) => pv.active),
        nillable: field.nillable,
        calculated: field.calculated,
        createable: field.createable,
        updateable: field.updateable
      })),
      childRelationships: (response.childRelationships || [])
        .filter((rel: any) => rel.relationshipName)
        .map((rel: any) => ({
          childSObject: rel.childSObject,
          relationshipName: rel.relationshipName,
          field: rel.field
        }))
    }

    cache.sobjects.set(cacheKey, {
      data: describe,
      timestamp: Date.now()
    })

    return describe
  } catch (error) {
    console.warn(`Failed to describe ${sobjectName}:`, error)
    return null
  }
}

export function clearDescribeCache(sfHost?: string): void {
  if (sfHost) {
    cacheByHost.delete(sfHost)
  } else {
    cacheByHost.clear()
  }
}

export async function getQueryableSObjects(sfHost: string): Promise<GlobalDescribeSObject[]> {
  const globalDescribe = await getGlobalDescribe(sfHost)
  return globalDescribe.sobjects.filter((obj) => obj.queryable)
}

export async function getFieldsForSObject(
  sfHost: string,
  sobjectName: string
): Promise<SObjectDescribeField[]> {
  const describe = await getSObjectDescribe(sfHost, sobjectName)
  return describe?.fields || []
}

export async function resolveRelationshipPath(
  sfHost: string,
  baseSObject: string,
  relationshipPath: string
): Promise<SObjectDescribeField[] | null> {
  const parts = relationshipPath.split('.').filter(Boolean)
  if (parts.length === 0) {
    return getFieldsForSObject(sfHost, baseSObject)
  }

  let currentSObject = baseSObject
  let currentDescribe = await getSObjectDescribe(sfHost, currentSObject)

  for (const part of parts) {
    if (!currentDescribe) return null

    const relationshipField = currentDescribe.fields.find(
      (f) => f.relationshipName?.toLowerCase() === part.toLowerCase()
    )

    if (!relationshipField || relationshipField.referenceTo.length === 0) {
      return null
    }

    currentSObject = relationshipField.referenceTo[0]
    currentDescribe = await getSObjectDescribe(sfHost, currentSObject)
  }

  return currentDescribe?.fields || null
}
