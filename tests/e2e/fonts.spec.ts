import { test, expect } from './fixtures/extension'
import type { Page } from '@playwright/test'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Bundled Inter font', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('the modal renders text with the bundled Inter typeface', async ({ extensionPage }) => {
    const page = extensionPage as Page

    // Collect every font request the RENDERER makes (not our probes). The
    // modal root declares font-family: Inter (styles.css), so opening it makes
    // Chromium fetch the @font-face src URLs from the host page origin - which
    // web_accessible_resources must permit, or the fetch fails and the UI
    // silently falls back to system fonts.
    const fontResponses: { url: string; status: number }[] = []
    page.on('response', (response) => {
      const url = response.url()
      if (url.includes('/assets/fonts/') && url.endsWith('.woff2')) {
        fontResponses.push({ url, status: response.status() })
      }
    })

    await uf.goHome()
    await uf.openModal()

    // Secondary evidence: the @font-face CSS is injected into the (open,
    // E2E-build) shadow root, and the page origin can fetch the woff2 directly.
    // Note: Chrome does not expose shadow-scoped @font-face faces on
    // document.fonts, so document.fonts.check()/load() cannot verify them -
    // the renderer network request above is the ground truth.
    const probe = await page.evaluate(async () => {
      const host = document.querySelector('[id^="ultraforce-modal"]')
      if (!host || !host.shadowRoot) {
        return { shadowOpen: !!host?.shadowRoot, srcUrl: null, fetchStatus: null }
      }
      const styleText = Array.from(host.shadowRoot.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .join('')
      const srcMatch = styleText.match(/url\('([^']+)'\)/)
      const srcUrl = srcMatch ? srcMatch[1] : null
      let fetchStatus: string | null = null
      if (srcUrl) {
        try {
          const resp = await fetch(srcUrl)
          fetchStatus = `fetch ${resp.status}`
        } catch (fetchError) {
          fetchStatus = `fetch threw: ${String(fetchError)}`
        }
      }
      return { shadowOpen: true, srcUrl, fetchStatus }
    })

    expect(probe.shadowOpen, 'modal shadow root is not open in the E2E build').toBe(true)
    expect(probe.srcUrl, '@font-face src URL not found in the injected modal styles').not.toBeNull()
    expect(probe.fetchStatus, `page-origin fetch of ${probe.srcUrl} was blocked (WAR missing?)`).toBe('fetch 200')

    // The renderer must have fetched at least one of the two bundled faces.
    const loadedFonts = fontResponses.filter((r) => r.status === 200)
    expect(fontResponses.length, `renderer made no font requests at all: ${JSON.stringify(fontResponses)}`).toBeGreaterThan(0)
    expect(
      loadedFonts.length,
      `renderer font requests all failed: ${JSON.stringify(fontResponses)}`
    ).toBeGreaterThan(0)
  })
})
