/**
 * Shared domain utility functions for Salesforce host normalization and detection.
 * Extracted from auth.ts and salesforce-api.ts to eliminate duplication.
 */

/**
 * Normalize a Salesforce hostname to its canonical my.salesforce.com form.
 * Handles Lightning, Setup, China domains, and Microsoft CAS proxy suffixes.
 */
export function normalizeHost(host: string): string {
  if (!host) return host
  let normalized = host.replace(/^https?:\/\//, '').replace(/^\./, '')

  normalized = normalized.replace(/\.lightning\.force\./, '.my.salesforce.')

  // China: .sandbox.setup. -> .sandbox.my., .setup. -> .my.
  normalized = normalized.replace(
    /\.sandbox\.(setup|lightning|file|content|c)\.sfcrmproducts\./,
    '.sandbox.my.sfcrmproducts.'
  )
  normalized = normalized.replace(
    /\.sandbox\.(setup|lightning|file|content|c)\.sfcrmapps\./,
    '.sandbox.my.sfcrmapps.'
  )
  normalized = normalized.replace(
    /\.(lightning|file|content|c|setup)\.sfcrmproducts\./,
    '.my.sfcrmproducts.'
  )
  normalized = normalized.replace(
    /\.(lightning|file|content|c|setup)\.sfcrmapps\./,
    '.my.sfcrmapps.'
  )

  normalized = normalized.replace(/\.mcas\.ms$/, '')

  return normalized
}

const SALESFORCE_DOMAIN_PATTERNS = [
  /\.salesforce\.com$/,
  /\.salesforce-setup\.com$/,
  /\.force\.com$/,
  /\.visual\.force\.com$/,
  /\.visualforce\.com$/,
  /\.sfcrmproducts\.cn$/,
  /\.sfcrmapps\.cn$/,
  /^login\.salesforce\.com$/,
  /^test\.salesforce\.com$/
]

/**
 * Check if a hostname belongs to a Salesforce domain.
 */
export function isSalesforceDomain(hostname: string): boolean {
  if (!hostname) return false
  return SALESFORCE_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname))
}

/**
 * Escape a string for safe use in SOQL queries.
 * Handles backslashes, single quotes, and LIKE wildcards (% and _).
 */
export function escapeSoql(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/_/g, '\\_')
}
