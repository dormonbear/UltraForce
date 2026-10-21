import { test, expect, chromium, type CDPSession } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Real Chrome senders and real cookies, in a disposable synthetic profile.
// CDP evaluates in the existing content-script world; product code is unchanged.
async function message(cdp: CDPSession, contextId: number, payload: unknown) {
  const response = await cdp.send('Runtime.evaluate', {
    contextId,
    expression: `chrome.runtime.sendMessage(${JSON.stringify(payload)})`,
    awaitPromise: true,
    returnByValue: true
  })
  expect(response.exceptionDetails).toBeUndefined()
  return response.result.value
}

test('built cookie bridge binds real content-script messages to their organization', async () => {
  test.setTimeout(60000)
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-auth-boundary-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  try {
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    const extensionId = new URL(worker.url()).hostname
    const own = 'acme.my.salesforce.com'
    const other = 'other.my.salesforce.com'
    const ownSession = '00D000000000001!synthetic-own-session'
    const foreignSession = '00D000000000002!synthetic-foreign-session'
    await context.addCookies([
      { name: 'sid', value: ownSession, url: `https://${own}` },
      { name: 'sid', value: foreignSession, url: `https://${other}` }
    ])
    const network: string[] = []
    await context.route('https://**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      network.push(url.hostname)
      if (request.isNavigationRequest()) {
        return route.fulfill({ contentType: 'text/html', body: '<html><body>Authentication fixture</body></html>' })
      }
      if (url.hostname !== own) return route.abort()
      return route.fulfill({ json: { records: [], totalSize: 0, done: true } })
    })

    const legacy = 'acme--pkg.na99.visual.force.com'
    for (const { source, resolvedHost, session } of [
      { source: own, resolvedHost: own, session: ownSession },
      { source: 'acme.lightning.force.com', resolvedHost: own, session: ownSession },
      { source: 'acme.my.salesforce-setup.com', resolvedHost: own, session: ownSession },
      { source: legacy, resolvedHost: legacy, session: '00D000000000001!unrelated-source-session' },
      { source: legacy, resolvedHost: own, session: ownSession }
    ]) {
      if (source === legacy) {
        await context.addCookies([{ name: 'sid', value: session, url: `https://${source}` }])
      }
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      const worlds = new Set<number>()
      cdp.on('Runtime.executionContextCreated', ({ context: world }) => {
        if (!world.auxData?.isDefault) worlds.add(world.id)
      })
      cdp.on('Runtime.executionContextDestroyed', ({ executionContextId }) => worlds.delete(executionContextId))
      cdp.on('Runtime.executionContextsCleared', () => worlds.clear())
      await cdp.send('Runtime.enable')
      await page.goto(`https://${source}/lightning/page/home`)
      await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
      let contentWorld: number | undefined
      await expect(async () => {
        for (const id of worlds) {
          const probe = await cdp.send('Runtime.evaluate', {
            contextId: id,
            expression: 'globalThis.chrome?.runtime?.id',
            returnByValue: true
          })
          if (probe.result.value === extensionId) contentWorld = id
        }
        expect(contentWorld).toBeDefined()
      }).toPass()
      const id = contentWorld!
      expect(await message(cdp, id, { message: 'getSfHost', url: page.url() })).toBe(resolvedHost)
      expect(await message(cdp, id, { message: 'getSession', sfHost: resolvedHost })).toEqual({
        key: session,
        hostname: resolvedHost
      })
      if (resolvedHost !== own) expect(await message(cdp, id, { message: 'getSession', sfHost: own })).toBeNull()
      expect(await message(cdp, id, { message: 'getSession', sfHost: other })).toBeNull()
      expect(await message(cdp, id, { message: 'getSfHost', url: `https://${other}/` })).toBeNull()
      expect(await message(cdp, id, { message: 'getSession', sfHost: `${own}@attacker.invalid` })).toBeNull()
      // A normal page script has no runtime connection: no externally_connectable
      // bridge is introduced or assumed by the defensive listener tests.
      expect(await page.evaluate(() => typeof globalThis.chrome?.runtime?.sendMessage)).toBe('undefined')
      await page.close()
    }
    expect(network).not.toContain(other)
    expect(network).not.toContain('attacker.invalid')
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest())
    expect(manifest.externally_connectable).toBeUndefined()
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
