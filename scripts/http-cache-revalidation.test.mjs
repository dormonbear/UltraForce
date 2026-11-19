import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

// Resolve the installed consumers through their real parent edges. / 通过实际父包依赖解析已安装的消费者。
const root = createRequire(import.meta.url)
const plasmo = createRequire(root.resolve('plasmo'))
const config = createRequire(plasmo.resolve('@plasmohq/parcel-config'))
const resolver = createRequire(config.resolve('@plasmohq/parcel-resolver'))
const consumers = [plasmo, resolver].map((parent) => {
  const gotPath = parent.resolve('got')
  const gotRequire = createRequire(gotPath)
  const cacheRequire = createRequire(gotRequire.resolve('cacheable-request'))
  return { gotPath, Policy: cacheRequire('http-cache-semantics') }
})
const request = { url: 'https://synthetic.invalid/value', method: 'GET', headers: { host: 'synthetic.invalid' } }

for (const [index, { Policy, gotPath }] of consumers.entries()) {
  for (const shared of [true, false]) {
    for (const [directive, allowed] of [
      ['public, max-age=0', true],
      ['public, max-age=0, no-cache', false],
      ['public, max-age=0, must-revalidate', false],
      ['public, max-age=0, proxy-revalidate', !shared],
      ['public, max-age=0, s-maxage=0', !shared],
      ['public, max-age=0, s-maxage=2', !shared]
    ]) {
      for (const maxStale of ['max-stale', 'max-stale=60']) {
        test(`policy ${index} shared=${shared} ${directive} ${maxStale} / 策略共享模式及响应指令优先级`, () => {
          const policy = new Policy(
            request,
            { status: 200, headers: { 'cache-control': directive, age: '5' } },
            { shared }
          )
          assert.equal(policy.storable(), true)
          const incoming = { ...request, headers: { ...request.headers, 'cache-control': maxStale } }
          assert.equal(policy.satisfiesWithoutRevalidation(incoming), allowed)
          const result = policy.evaluateRequest(incoming)
          assert.equal(Boolean(result.revalidation), !allowed)
          if (!allowed) assert.equal(result.revalidation.synchronous, true)
        })
      }
    }
    test(`policy ${index} shared=${shared} fresh and storage controls / 新鲜度及存储控制`, () => {
      const policy = (directive) =>
        new Policy(request, { status: 200, headers: { 'cache-control': directive } }, { shared })
      assert.equal(policy('public, max-age=60').satisfiesWithoutRevalidation(request), true)
      assert.equal(policy('public, max-age=60, no-cache').satisfiesWithoutRevalidation(request), false)
      assert.equal(policy('no-store').storable(), false)
      assert.equal(policy('private, max-age=60').storable(), !shared)
      if (!shared) {
        assert.equal(policy('max-age=60, s-maxage=0').satisfiesWithoutRevalidation(request), true)
        assert.equal(policy('max-age=60, proxy-revalidate').satisfiesWithoutRevalidation(request), true)
      }
      const stale = policy('public, max-age=0, stale-if-error=60')
      assert.equal(stale.revalidatedPolicy(request, { status: 503, headers: {} }).modified, false)
      assert.equal(
        policy('public, max-age=0, stale-while-revalidate=60').evaluateRequest(request).revalidation.synchronous,
        false
      )
    })
  }

  for (const directive of [
    'public, max-age=0',
    'public, max-age=0, no-cache',
    'public, max-age=0, must-revalidate',
    'public, max-age=0, proxy-revalidate',
    'public, max-age=60, s-maxage=0',
    'private, max-age=60',
    'no-store'
  ]) {
    for (const conditional of [false, true]) {
      test(`Got ${index} ${directive} conditional=${conditional} / 实际消费者验证响应及条件请求`, async () => {
        const { default: got } = await import(pathToFileURL(gotPath).href)
        let requests = 0
        const seen = []
        const server = createServer((req, res) => {
          requests++
          seen.push(req.headers)
          res.setHeader('cache-control', directive)
          res.setHeader('etag', '"synthetic-v1"')
          if (conditional && req.headers['if-none-match'] === '"synthetic-v1"') {
            res.writeHead(304)
            res.end()
          } else {
            res.end(requests === 1 ? 'synthetic-v1' : 'synthetic-v2')
          }
        })
        server.listen(0, '127.0.0.1')
        await once(server, 'listening')
        try {
          const cache = new Map()
          const url = `http://127.0.0.1:${server.address().port}/synthetic`
          const options = {
            cache,
            retry: { limit: 0 },
            timeout: { request: 5000 },
            headers: { cookie: 'synthetic=fixture' }
          }
          assert.equal((await got(url, options)).body, 'synthetic-v1')
          // Allow asynchronous cache storage without timing-based freshness assumptions. / 等待异步缓存写入，避免依赖时间的新鲜度假设。
          await new Promise((resolve) => setImmediate(resolve))
          const response = await got(url, {
            ...options,
            headers: { ...options.headers, 'cache-control': 'max-stale=60' }
          })
          const reuse = directive === 'public, max-age=0'
          const storable = !directive.startsWith('private') && directive !== 'no-store'
          assert.equal(requests, reuse ? 1 : 2)
          assert.equal(cache.size > 0, storable)
          assert.equal(response.body, reuse || (conditional && storable) ? 'synthetic-v1' : 'synthetic-v2')
          if (!reuse) {
            assert.equal(seen[1].cookie, 'synthetic=fixture')
            assert.equal(seen[1]['if-none-match'], storable ? '"synthetic-v1"' : undefined)
          }
        } finally {
          await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
        }
      })
    }
  }
}
