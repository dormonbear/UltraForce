/**
 * Salesforce ID detection, extraction, and validation utilities.
 *
 * Handles plain IDs, full Salesforce URLs, Lightning URLs,
 * and mixed text containing embedded IDs.
 */

const SF_ID_15 = /^[a-zA-Z0-9]{15}$/
const SF_ID_18 = /^[a-zA-Z0-9]{18}$/
const SF_ID_PATTERN = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/

/**
 * Validates whether a string is a valid Salesforce ID (15 or 18 chars).
 * Trims whitespace before checking.
 */
export function isSalesforceId(str: string): boolean {
  const trimmed = str.trim()
  return SF_ID_15.test(trimmed) || SF_ID_18.test(trimmed)
}

/**
 * Extracts a Salesforce ID from various input formats:
 * - Plain ID: "001xxxxxxxxxxxx"
 * - Full URL: "https://org.salesforce.com/001xxxxxxxxxxxx"
 * - Lightning URL: "https://org.lightning.force.com/lightning/r/Account/001xxxxxxxxxxxx/view"
 * - Mixed text: "check record 001XXXXXXXXXXXXXXX please"
 *
 * Returns null if no valid ID is found.
 */
export function extractSalesforceId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Direct ID check
  if (isSalesforceId(trimmed)) return trimmed

  // Try URL extraction
  try {
    const url = new URL(trimmed)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    // Walk segments in reverse — ID is usually near the end
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      if (isSalesforceId(pathSegments[i])) return pathSegments[i]
    }
  } catch {
    // Not a URL — fall through to regex extraction
  }

  // Extract first ID-like pattern from mixed text
  // Prefer 18-char matches over 15-char for accuracy
  const match = trimmed.match(SF_ID_PATTERN)
  if (match && isSalesforceId(match[0])) return match[0]

  return null
}

/**
 * Returns the 3-character key prefix from a Salesforce ID.
 * The key prefix identifies the object type (e.g., "001" = Account).
 */
export function getKeyPrefix(id: string): string {
  return id.substring(0, 3)
}
