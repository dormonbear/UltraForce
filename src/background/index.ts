/**
 * UltraForce Background Script
 * Handles cookie-based authentication for Salesforce API access
 */

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
    await chrome.storage.local.set({
      settings: {
        searchLimit: 1000,
        autoSearch: true,
        showDebug: false
      }
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

    // Handle China setup domains - convert to my domains
    if (currentDomain.endsWith('.setup.sfcrmproducts.cn')) {
      const orgName = currentDomain.replace('.setup.sfcrmproducts.cn', '')
      const myDomain = `${orgName}.my.sfcrmproducts.cn`

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

    if (currentDomain.endsWith('.setup.sfcrmapps.cn')) {
      const orgName = currentDomain.replace('.setup.sfcrmapps.cn', '')
      const myDomain = `${orgName}.my.sfcrmapps.cn`

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

    const cookie = await chrome.cookies.get({
      url: request.url,
      name: 'sid',
      storeId
    })

    if (!cookie) {
      // Try to find cookie on my.salesforce.com for current org
      const orgName = currentDomain.split('.')[0]
      const myDomainCandidates = [
        `${orgName}.my.salesforce.com`,
        `${orgName}.my.sfcrmproducts.cn`,
        `${orgName}.my.sfcrmapps.cn`
      ]

      for (const myDomain of myDomainCandidates) {
        try {
          const myDomainCookie = await chrome.cookies.get({
            url: `https://${myDomain}`,
            name: 'sid',
            storeId
          })

          if (myDomainCookie) {
            sendResponse(myDomain)
            return
          }
        } catch (e) {
          // Continue to next candidate
        }
      }

      sendResponse(currentDomain)
      return
    }

    const [orgId] = cookie.value.split('!')
    const orgName = currentDomain.split('.')[0]

    const myDomainCandidates = [
      `${orgName}.my.sfcrmproducts.cn`,
      `${orgName}.my.salesforce.com`,
      `${orgName}.my.sfcrmapps.cn`
    ]

    for (const myDomain of myDomainCandidates) {
      try {
        const myDomainCookie = await chrome.cookies.get({
          url: `https://${myDomain}`,
          name: 'sid',
          storeId
        })

        if (myDomainCookie) {
          const myOrgId = myDomainCookie.value.split('!')[0]
          if (myOrgId === orgId || !orgId) {
            sendResponse(myDomain)
            return
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
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

/**
 * Handle getSession message
 */
async function handleGetSession(
  request: { sfHost: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { key: string; hostname: string } | null) => void
) {
  try {
    const sfHost = request.sfHost
    const storeId = sender.tab?.cookieStoreId

    const sessionCookie = await chrome.cookies.get({
      url: `https://${sfHost}`,
      name: 'sid',
      storeId
    })

    if (!sessionCookie) {
      sendResponse(null)
      return
    }

    sendResponse({
      key: sessionCookie.value,
      hostname: sessionCookie.domain
    })
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
    } catch (error) {
      // Content script not ready
    }
  }
})

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'toggle-modal') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0]
      if (tab?.id && tab.url && isSalesforceTab(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' })
        } catch (error) {
          // Content script not ready
        }
      }
    })
  }
})

export {}
