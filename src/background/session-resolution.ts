/** Cookie resolution stays bound to the requesting Salesforce document. */
const COOKIE_DOMAINS = ['salesforce.com', 'force.com', 'visualforce.com', 'sfcrmproducts.cn', 'sfcrmapps.cn']
const DOCUMENT_DOMAINS = [...COOKIE_DOMAINS, 'salesforce-setup.com']

function validHostname(host: string): boolean {
  return host.length <= 253 && host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
}

function supportedHost(host: string): boolean {
  return validHostname(host) && DOCUMENT_DOMAINS.some((domain) => host.endsWith(`.${domain}`))
}

export function salesforceDocumentUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\s\\]/.test(value)) return null
  try {
    const url = new URL(value)
    const authority = value.slice(8).split(/[/?#]/)[0].toLowerCase()
    if (authority !== url.hostname && authority !== `${url.hostname}:443`) return null
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !supportedHost(url.hostname))
      return null
    return url
  } catch {
    return null
  }
}

export function sessionTargetHost(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const host = value.toLowerCase()
  return supportedHost(host) ? host : null
}

function mappedHosts(host: string): string[] {
  if (host.endsWith('.my.salesforce-setup.com'))
    return [host.replace(/\.my\.salesforce-setup\.com$/, '.my.salesforce.com')]
  if (host.endsWith('.salesforce-setup.com')) return [host.replace(/\.salesforce-setup\.com$/, '.my.salesforce.com')]
  if (host.endsWith('.lightning.force.com')) return [host.replace(/\.lightning\.force\.com$/, '.my.salesforce.com')]

  // Enhanced Visualforce includes a namespace suffix; remove only the last
  // suffix so a sandbox's org--sandbox label is preserved.
  const visual = host.match(/^([^.]+)--[^.]+(\.sandbox)?\.(?:vf\.force\.com|visual\.force\.com|visualforce\.com)$/)
  if (visual) return [`${visual[1]}${visual[2] || ''}.my.salesforce.com`]

  const china = host.match(/^(.+)\.(setup|lightning|file|content|c|my)\.(sfcrmproducts|sfcrmapps)\.cn$/)
  if (china) {
    const [, org, , family] = china
    return family === 'sfcrmapps'
      ? [`${org}.my.sfcrmproducts.cn`, `${org}.my.sfcrmapps.cn`]
      : [`${org}.my.sfcrmproducts.cn`]
  }
  if (host.endsWith('.sfcrmapps.cn')) return [host.replace(/\.sfcrmapps\.cn$/, '.sfcrmproducts.cn')]
  return []
}

function orgId(value: string): string | null {
  const prefix = value.split('!')[0]
  return /^00D[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(prefix) && value.includes('!') && value.split('!')[1]
    ? prefix.slice(0, 15)
    : null
}

interface ResolvedSession {
  host: string
  cookie: chrome.cookies.Cookie | null
}

export async function resolveDocumentSession(source: URL, storeId?: string): Promise<ResolvedSession> {
  const host = source.hostname
  const read = async (candidate: string) => {
    const cookie = await chrome.cookies.get({ url: `https://${candidate}`, name: 'sid', storeId })
    if (!cookie?.value) return null
    const domain = cookie.domain.replace(/^\./, '').toLowerCase()
    // Defend the response boundary as well as the lookup boundary. Return the
    // lookup host, never a broad cookie Domain as an API destination.
    return validHostname(domain) && (candidate === domain || candidate.endsWith(`.${domain}`)) ? cookie : null
  }
  const sourceCookie = await read(host)
  const sourceOrg = sourceCookie ? orgId(sourceCookie.value) : null
  for (const candidate of mappedHosts(host).filter((candidate) => candidate !== host)) {
    const cookie = await read(candidate)
    if (cookie && (!sourceCookie || (sourceOrg && orgId(cookie.value) === sourceOrg))) {
      return { host: candidate, cookie }
    }
  }

  // A public org ID prefix cannot authorize discovery of another session.
  // For unknown legacy shapes require the full document session to match;
  // otherwise keep the current host and let the user open MyDomain/Lightning.
  const isApiHost = /\.(?:my\.)?salesforce\.com$/.test(host) || /\.my\.sfcrm(?:products|apps)\.cn$/.test(host)
  if (sourceOrg && !isApiHost) {
    for (const domain of COOKIE_DOMAINS) {
      const cookies = await chrome.cookies.getAll({ name: 'sid', domain, secure: true, storeId })
      for (const cookie of cookies) {
        const candidate = cookie.domain.replace(/^\./, '').toLowerCase()
        if (
          candidate === host ||
          candidate === 'help.salesforce.com' ||
          !supportedHost(candidate) ||
          cookie.value !== sourceCookie?.value
        )
          continue
        // getAll may include a different path/store cookie. Confirm that the
        // actual HTTPS root lookup yields that exact session before using it.
        const confirmed = await read(candidate)
        if (confirmed && confirmed.value === sourceCookie?.value) return { host: candidate, cookie: confirmed }
      }
    }
  }
  return { host, cookie: sourceCookie }
}
