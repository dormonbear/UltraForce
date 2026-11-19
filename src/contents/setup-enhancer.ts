import type { PlasmoCSConfig } from 'plasmo'
import { claimExtensionScript, isExtensionContextValid } from '~lib/extension-context'
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

const SETUP_START_EVENT = 'ultraforce:setup-start'

class SetupEnhancer {
  private readonly listeners = new AbortController()
  private urlObserver?: MutationObserver
  private isLoading = false
  private observer: MutationObserver | null = null
  private pendingCheck?: ReturnType<typeof setTimeout>
  private scrollGeneration = 0
  private completedUrls = new Set<string>()

  constructor(private readonly release: () => void) {
    const { signal } = this.listeners
    window.addEventListener('beforeunload', () => this.destroy(), { signal })
    document.addEventListener(SETUP_START_EVENT, () => this.checkContext(), { signal })

    const start = () => {
      if (!this.checkContext()) return
      if (useSettingsStore.getState().autoLoadFields === false) return
      this.setupUrlWatcher()
      this.checkAndEnhancePage()
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true, signal })
    } else {
      start()
    }
  }

  private checkContext(): boolean {
    if (this.listeners.signal.aborted) return false
    if (isExtensionContextValid()) return true
    this.destroy()
    return false
  }

  private setupUrlWatcher(): void {
    let lastUrl = location.href
    const onNavigation = () => {
      if (!this.checkContext()) return
      lastUrl = location.href
      this.stopAutoScroll()
      this.pendingCheck = setTimeout(() => this.checkAndEnhancePage(), 1000)
    }

    this.urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) onNavigation()
    })
    this.urlObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', onNavigation, { signal: this.listeners.signal })
  }

  private getUrlKey(): string {
    const url = new URL(location.href)
    return `${url.origin}${url.pathname}`
  }

  private checkAndEnhancePage(): void {
    if (!this.checkContext()) return

    const url = location.href
    const urlKey = this.getUrlKey()

    if (this.completedUrls.has(urlKey)) {
      logger.debug('Page already processed, skipping auto-load')
      return
    }

    if (url.includes('/FieldsAndRelationships/view')) {
      logger.debug('Detected Fields & Relationships page, starting auto-load...')
      this.pendingCheck = setTimeout(() => this.autoLoadAllContent(urlKey), 2000)
    }
  }

  private async autoLoadAllContent(urlKey: string): Promise<void> {
    if (this.isLoading || !this.checkContext()) return
    this.isLoading = true
    const generation = this.scrollGeneration

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
        if (generation !== this.scrollGeneration || !this.checkContext()) return

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
      if (generation === this.scrollGeneration) this.isLoading = false
    }
  }

  private disableInfiniteScroll(scrollContainer: HTMLElement): void {
    const seenIds = new Set<string>()

    const collectIds = () => {
      const rows = scrollContainer.querySelectorAll('tr[data-row-key-value], [data-row-key-value]')
      rows.forEach((row) => {
        const id = row.getAttribute('data-row-key-value')
        if (id) seenIds.add(id)
      })
    }

    collectIds()
    logger.debug(`Tracking ${seenIds.size} unique items`)

    const duplicateObserver = new MutationObserver((mutations) => {
      let removedCount = 0
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const rows = node.querySelectorAll
              ? [node, ...Array.from(node.querySelectorAll('[data-row-key-value]'))]
              : [node]

            rows.forEach((row) => {
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
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private stopAutoScroll(): void {
    clearTimeout(this.pendingCheck)
    this.scrollGeneration++
    this.isLoading = false
  }

  private destroy(): void {
    this.listeners.abort()
    this.release()
    this.stopAutoScroll()
    this.urlObserver?.disconnect()
    this.observer?.disconnect()
  }
}

document.dispatchEvent(new Event(SETUP_START_EVENT))
const release = claimExtensionScript('setup-enhancer')
if (release) new SetupEnhancer(release)
