/** Cookie authentication and extension keyboard actions. */
import { STORAGE_KEYS, storageSet, storageRemove } from '~lib/storage-service'
import { logger } from '~lib/logger'
import { resolveDocumentSession, salesforceDocumentUrl, sessionTargetHost } from './session-resolution'

// Remove deprecated diagnostics by key without inspecting their contents.
function removeLegacyDiagnostics(): Promise<void> {
  return storageRemove(['ultraforce_error_logs', 'ultraforce_api_stats'])
}
void removeLegacyDiagnostics()
chrome.runtime.onStartup.addListener(() => {
  void removeLegacyDiagnostics()
})
chrome.runtime.onInstalled.addListener(async (details) => {
  await removeLegacyDiagnostics()
  if (details.reason === 'install') {
    await storageSet(STORAGE_KEYS.LEGACY_SETTINGS, { searchLimit: 1000, autoSearch: true, showDebug: false })
  }
})

// Authenticate the document, not its top-level tab or a payload URL.
// An opaque/missing document identity must fail closed.
function trustedDocument(sender: chrome.runtime.MessageSender): URL | null {
  if (!sender.id || sender.id !== chrome.runtime.id) return null
  const document = salesforceDocumentUrl(sender.url)
  if (!document) return null
  if (sender.origin !== undefined && sender.origin !== document.origin) return null
  return document
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.message === 'getSfHost' || request.message === 'getSession')) {
    const document = trustedDocument(sender)
    const targetUrl = request.message === 'getSfHost' ? salesforceDocumentUrl(request.url) : null
    const targetHost = request.message === 'getSession' ? sessionTargetHost(request.sfHost) : null
    if (!document || (request.message === 'getSfHost' ? targetUrl?.origin !== document.origin : !targetHost)) {
      sendResponse(null)
      return false
    }
    // @ts-expect-error Firefox container tab API
    const storeId = sender.tab?.cookieStoreId
    void resolveDocumentSession(document, storeId)
      .then((resolved) => {
        if (request.message === 'getSfHost') {
          sendResponse(resolved.host)
        } else if (targetHost === document.hostname || targetHost === resolved.host) {
          sendResponse(resolved.cookie ? { key: resolved.cookie.value, hostname: resolved.host } : null)
        } else {
          sendResponse(null)
        }
      })
      .catch(() => {
        logger.error('Session resolution failed')
        sendResponse(null)
      })
    return true
  }
  if (request?.action === 'ping') {
    sendResponse({ success: true, message: 'Background script is running' })
    return false
  }
  sendResponse({ success: false, error: 'Unknown message' })
  return false
})

function isSalesforceTab(url: string): boolean {
  return salesforceDocumentUrl(url) !== null
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
