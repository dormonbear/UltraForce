import type { PlasmoCSConfig } from 'plasmo'
import { logger } from '~lib/logger'
import { useSettingsStore } from '~stores/settings-store'

export const config: PlasmoCSConfig = {
  matches: [
    'https://*.salesforce-setup.com/*',
    'https://*.salesforce.com/lightning/setup/*',
    'https://*.setup.sfcrmproducts.cn/*',
    'https://*.setup.sfcrmapps.cn/*'
  ],
  run_at: 'document_idle'
}

/**
 * Setup Page Enhancer
 * Auto-loads all content on lazy-loaded Setup pages
 */
class SetupEnhancer {
  private isLoading = false
  private observer: MutationObserver | null = null
  private scrollInterval: number | null = null
  private enabled = true
  private completedUrls = new Set<string>()

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    const { autoLoadFields } = useSettingsStore.getState()
    if (autoLoadFields === false) {
      this.enabled = false
      return
    }

    this.setupUrlWatcher()
    this.checkAndEnhancePage()
  }

  private setupUrlWatcher(): void {
    let lastUrl = location.href

    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        this.stopAutoScroll()
        setTimeout(() => this.checkAndEnhancePage(), 1000)
      }
    })

    urlObserver.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('popstate', () => {
      this.stopAutoScroll()
      setTimeout(() => this.checkAndEnhancePage(), 1000)
    })
  }

  private getUrlKey(): string {
    const url = new URL(location.href)
    return `${url.origin}${url.pathname}`
  }

  private checkAndEnhancePage(): void {
    if (!this.enabled) return

    const url = location.href
    const urlKey = this.getUrlKey()

    if (this.completedUrls.has(urlKey)) {
      logger.debug('Page already processed, skipping auto-load')
      return
    }

    if (url.includes('/FieldsAndRelationships/view')) {
      logger.debug('Detected Fields & Relationships page, starting auto-load...')
      setTimeout(() => this.autoLoadAllContent(urlKey), 2000)
    }
  }

  private async autoLoadAllContent(urlKey: string): Promise<void> {
    if (this.isLoading) return
    this.isLoading = true

    this.completedUrls.add(urlKey)

    try {
      const scrollContainer = this.findScrollContainer()
      if (!scrollContainer) {
        logger.debug('Scroll container not found')
        this.isLoading = false
        return
      }

      let previousHeight = 0
      let sameHeightCount = 0
      const maxAttempts = 50

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight

        await this.wait(500)

        const currentHeight = scrollContainer.scrollHeight

        if (currentHeight === previousHeight) {
          sameHeightCount++
          if (sameHeightCount >= 3) {
            logger.debug(`Auto-load complete after ${attempt + 1} scroll attempts`)
            break
          }
        } else {
          sameHeightCount = 0
          previousHeight = currentHeight
        }
      }

      scrollContainer.scrollTop = 0

      this.disableInfiniteScroll(scrollContainer)
    } catch (error) {
      logger.error('Auto-load error:', error)
      this.completedUrls.delete(urlKey)
    } finally {
      this.isLoading = false
    }
  }

  private disableInfiniteScroll(scrollContainer: HTMLElement): void {
    const seenIds = new Set<string>()

    const collectIds = () => {
      const rows = scrollContainer.querySelectorAll('tr[data-row-key-value], [data-row-key-value]')
      rows.forEach(row => {
        const id = row.getAttribute('data-row-key-value')
        if (id) seenIds.add(id)
      })
    }

    collectIds()
    logger.debug(`Tracking ${seenIds.size} unique items`)

    const duplicateObserver = new MutationObserver((mutations) => {
      let removedCount = 0
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            const rows = node.querySelectorAll ?
              [node, ...Array.from(node.querySelectorAll('[data-row-key-value]'))] :
              [node]

            rows.forEach(row => {
              if (row instanceof HTMLElement) {
                const id = row.getAttribute('data-row-key-value')
                if (id) {
                  if (seenIds.has(id)) {
                    row.remove()
                    removedCount++
                  } else {
                    seenIds.add(id)
                  }
                }
              }
            })
          }
        })
      })
      if (removedCount > 0) {
        logger.debug(`Removed ${removedCount} duplicate items`)
      }
    })

    duplicateObserver.observe(scrollContainer, {
      childList: true,
      subtree: true
    })

    this.observer = duplicateObserver
  }

  private findScrollContainer(): HTMLElement | null {
    const selectors = [
      '.viewport.scroller',
      '.slds-scrollable_y',
      '[data-aura-class="uiScroller"]',
      '.scroller.actionBody',
      '.oneContent .scroller',
      'div[style*="overflow: auto"]',
      'div[style*="overflow-y: auto"]'
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement
      if (element && element.scrollHeight > element.clientHeight) {
        return element
      }
    }

    const allDivs = document.querySelectorAll('div')
    for (const div of allDivs) {
      const el = div as HTMLElement
      if (
        el.scrollHeight > el.clientHeight + 100 &&
        el.clientHeight > 200 &&
        getComputedStyle(el).overflowY !== 'visible' &&
        getComputedStyle(el).overflowY !== 'hidden'
      ) {
        return el
      }
    }

    return document.documentElement
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval)
      this.scrollInterval = null
    }
    this.isLoading = false
  }

  public destroy(): void {
    this.stopAutoScroll()
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

// Initialize
let enhancer: SetupEnhancer | null = null

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    enhancer = new SetupEnhancer()
  })
} else {
  enhancer = new SetupEnhancer()
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (enhancer) {
    enhancer.destroy()
  }
})

export {}
