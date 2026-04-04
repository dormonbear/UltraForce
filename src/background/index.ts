/**
 * UltraForce Background Script
 * Handles cookie-based authentication for Salesforce API access
 */

import { STORAGE_KEYS, storageSet } from '~lib/storage-service'

import { logger } from '~lib/logger'

// Salesforce domains to search for session cookies
const SF_DOMAINS = [
  'salesforce.com',
  'cloudforce.com',
  'salesforce.mil',
  'cloudforce.mil',
  'sfcrmproducts.cn',
  'sfcrmapps.cn',
  'force.com'
]

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await storageSet(STORAGE_KEYS.LEGACY_SETTINGS, {
      searchLimit: 1000,
      autoSearch: true,
      showDebug: false
    })
  }
})

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getSfHost') {
    handleGetSfHost(request, sender, sendResponse)
    return true
  }

  if (request.message === 'getSession') {
    handleGetSession(request, sender, sendResponse)
    return true
  }

  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Background script is running' })
    return false
  }

  sendResponse({ success: false, error: 'Unknown message' })
  return false
})

/**
 * Handle getSfHost message
 */
async function handleGetSfHost(
  request: { url: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: string | null) => void
) {
  try {
    const currentDomain = new URL(request.url).hostname
    // @ts-expect-error Firefox container tab API
    const storeId = sender.tab?.cookieStoreId

    if (currentDomain.endsWith('.mcas.ms')) {
      sendResponse(currentDomain)
      return
    }

    // Handle salesforce-setup.com domain - convert to my.salesforce.com
    if (currentDomain.endsWith('.salesforce-setup.com')) {
      const orgName = currentDomain.replace('.my.salesforce-setup.com', '').replace('.salesforce-setup.com', '')
      const myDomain = `${orgName}.my.salesforce.com`

      const myDomainCookie = await chrome.cookies.get({
        url: `https://${myDomain}`,
        name: 'sid',
        storeId
      })

      if (myDomainCookie) {
        sendResponse(myDomain)
        return
      }
    }

    // China sandbox domains: .sandbox.setup. -> .sandbox.my.
    const sfcrmproductsSandboxMatch = currentDomain.match(/^(.+)\.sandbox\.(setup|lightning|file|content|c)\.sfcrmproducts\.cn$/)
    if (sfcrmproductsSandboxMatch) {
      const orgName = sfcrmproductsSandboxMatch[1]
      const myDomain = `${orgName}.sandbox.my.sfcrmproducts.cn`
      const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
      if (myDomainCookie) {
        sendResponse(myDomain)
        return
      }
    }

    // China production domains: .setup. -> .my.
    const sfcrmproductsSetupMatch = currentDomain.match(/^(.+)\.(setup|lightning|file|content|c)\.sfcrmproducts\.cn$/)
    if (sfcrmproductsSetupMatch) {
      const orgName = sfcrmproductsSetupMatch[1]
      const myDomain = `${orgName}.my.sfcrmproducts.cn`
      const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
      if (myDomainCookie) {
        sendResponse(myDomain)
        return
      }
    }

    // SFoA sandbox: sfcrmapps.cn uses sfcrmproducts.cn cookies
    const sfcrmappsSandboxMatch = currentDomain.match(/^(.+)\.sandbox\.(setup|lightning|file|content|c)\.sfcrmapps\.cn$/)
    if (sfcrmappsSandboxMatch) {
      const orgName = sfcrmappsSandboxMatch[1]
      for (const myDomain of [`${orgName}.sandbox.my.sfcrmproducts.cn`, `${orgName}.sandbox.my.sfcrmapps.cn`]) {
        const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
        if (myDomainCookie) {
          sendResponse(myDomain)
          return
        }
      }
    }

    // SFoA production: sfcrmapps.cn uses sfcrmproducts.cn cookies
    const sfcrmappsSetupMatch = currentDomain.match(/^(.+)\.(setup|lightning|file|content|c)\.sfcrmapps\.cn$/)
    if (sfcrmappsSetupMatch) {
      const orgName = sfcrmappsSetupMatch[1]
      for (const myDomain of [`${orgName}.my.sfcrmproducts.cn`, `${orgName}.my.sfcrmapps.cn`]) {
        const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
        if (myDomainCookie) {
          sendResponse(myDomain)
          return
        }
      }
    }

    const cookie = await chrome.cookies.get({
      url: request.url,
      name: 'sid',
      storeId
    })

    if (!cookie) {
      const orgName = currentDomain.split('.')[0]
      const myDomainCandidates = currentDomain.endsWith('.sfcrmapps.cn')
        ? [`${orgName}.my.sfcrmproducts.cn`, `${orgName}.my.sfcrmapps.cn`, `${orgName}.my.salesforce.com`]
        : [`${orgName}.my.salesforce.com`, `${orgName}.my.sfcrmproducts.cn`, `${orgName}.my.sfcrmapps.cn`]

      for (const myDomain of myDomainCandidates) {
        try {
          const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
          if (myDomainCookie) {
            sendResponse(myDomain)
            return
          }
        } catch {}
      }

      sendResponse(currentDomain)
      return
    }

    const [orgId] = cookie.value.split('!')
    const orgName = currentDomain.split('.')[0]
    const myDomainCandidates2 = currentDomain.endsWith('.sfcrmapps.cn')
      ? [`${orgName}.my.sfcrmproducts.cn`, `${orgName}.my.sfcrmapps.cn`, `${orgName}.my.salesforce.com`]
      : [`${orgName}.my.sfcrmproducts.cn`, `${orgName}.my.salesforce.com`, `${orgName}.my.sfcrmapps.cn`]

    for (const myDomain of myDomainCandidates2) {
      try {
        const myDomainCookie = await chrome.cookies.get({ url: `https://${myDomain}`, name: 'sid', storeId })
        if (myDomainCookie) {
          const myOrgId = myDomainCookie.value.split('!')[0]
          if (myOrgId === orgId || !orgId) {
            sendResponse(myDomain)
            return
          }
        }
      } catch {}
    }

    for (const domain of SF_DOMAINS) {
      const cookies = await chrome.cookies.getAll({
        name: 'sid',
        domain,
        secure: true,
        storeId
      })

      const sessionCookie = cookies.find(
        (c) => c.value.startsWith(orgId + '!') && c.domain !== 'help.salesforce.com'
      )

      if (sessionCookie) {
        sendResponse(sessionCookie.domain)
        return
      }
    }

    sendResponse(currentDomain)
  } catch (error) {
    logger.error('Error in getSfHost:', error)
    sendResponse(null)
  }
}

async function handleGetSession(
  request: { sfHost: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { key: string; hostname: string } | null) => void
) {
  try {
    const sfHost = request.sfHost
    // @ts-expect-error Firefox container tab API
    const storeId = sender.tab?.cookieStoreId
    const domainsToCheck = [sfHost]

    // SFoA: sfcrmapps.cn uses sfcrmproducts.cn cookies
    if (sfHost.endsWith('.sfcrmapps.cn')) {
      domainsToCheck.unshift(sfHost.replace('.sfcrmapps.cn', '.sfcrmproducts.cn'))
    }

    for (const host of domainsToCheck) {
      const sessionCookie = await chrome.cookies.get({ url: `https://${host}`, name: 'sid', storeId })
      if (sessionCookie) {
        sendResponse({ key: sessionCookie.value, hostname: sessionCookie.domain })
        return
      }
    }

    sendResponse(null)
  } catch (error) {
    logger.error('Error in getSession:', error)
    sendResponse(null)
  }
}

function isSalesforceTab(url: string): boolean {
  if (!url) return false

  const salesforcePatterns = [
    /https:\/\/.*\.salesforce\.com/,
    /https:\/\/.*\.salesforce-setup\.com/,
    /https:\/\/.*\.visual\.force\.com/,
    /https:\/\/.*\.visualforce\.com/,
    /https:\/\/.*\.lightning\.force\.com/,
    /https:\/\/.*\.my\.salesforce\.com/,
    /https:\/\/.*\.force\.com/,
    /https:\/\/.*\.sfcrmapps\.cn/,
    /https:\/\/.*\.sfcrmproducts\.cn/
  ]

  return salesforcePatterns.some((pattern) => pattern.test(url))
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && isSalesforceTab(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id!, { action: 'toggleModal' })
    } catch {
      // Content script not ready
    }
  }
})

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'toggle-search') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0]
      if (tab?.id && tab.url && isSalesforceTab(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' })
        } catch {
          // Content script not ready
        }
      }
    })
  }
})

export {}
