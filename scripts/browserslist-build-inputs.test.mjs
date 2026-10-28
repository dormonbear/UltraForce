import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nodeTest, { after } from 'node:test'
import { runInNewContext } from 'node:vm'

// Keep inherited Browserslist switches and external stats out of this isolated test process. / 隔离测试进程不继承 Browserslist 开关及外部统计。
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('BROWSERSLIST')))
for (const key of Object.keys(inherited)) delete process.env[key]
process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true'
const fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-browserslist-root-')))
after(() => {
  for (const key of Object.keys(process.env)) if (key.startsWith('BROWSERSLIST')) delete process.env[key]
  Object.assign(process.env, inherited)
  rmSync(fixtureRoot, { recursive: true, force: true })
})

// Resolve the real Parcel consumer, not a separate test-only dependency. / 解析真实 Parcel 调用方，不另装仅测试依赖。
const require = createRequire(import.meta.url)
const plasmo = createRequire(require.resolve('plasmo'))
const parcel = createRequire(plasmo.resolve('@parcel/core'))
const { LMDBCache } = parcel('@parcel/cache')
const config = createRequire(plasmo.resolve('@plasmohq/parcel-config'))
const inlineCss = createRequire(config.resolve('@plasmohq/parcel-transformer-inline-css'))

function registerConsumer(label, consumer) {
  const test = (name, run) => nodeTest(`${label}: ${name}`, run)
  const browserslist = consumer('browserslist')
  const statsLoader = consumer('browserslist/node')
  const entry = consumer.resolve('browserslist')
  const resolve = (query, options = {}) => browserslist(query, { path: fixtureRoot, stats: {}, ...options })

  function temporary(run) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-browserslist-')))
    try {
      return run(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  // Reference identity detects eviction deterministically; the child only bounds resources. / 引用一致性确定性检测淘汰，子进程仅限制资源。
  function bounded(source) {
    const result = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=96',
        '--input-type=module',
        '-e',
        `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const browserslist = createRequire(import.meta.url)(process.argv[1])
const resolve = (query) => browserslist(query, { stats: {} })
${source}
process.stdout.write('ok')
`,
        entry
      ],
      {
        cwd: fixtureRoot,
        env: { ...process.env },
        encoding: 'utf8',
        timeout: 8000,
        killSignal: 'SIGKILL',
        maxBuffer: 65536
      }
    )
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.equal(result.status, 0, result.stderr.slice(0, 1500))
    assert.equal(result.stdout, 'ok')
  }

  for (const key of ['__proto__', 'toString', 'valueOf', 'constructor', 'hasOwnProperty', 'isPrototypeOf']) {
    test(`custom stats key ${key} cannot crash an unrelated browser query / 自定义统计键不能令无关浏览器查询崩溃`, () => {
      const stats = JSON.parse(`{"${key}":{"onekey":5},"chrome":{"100":50}}`)
      assert.deepEqual(resolve('chrome 100', { stats }), ['chrome 100'])
    })
  }

  test('normalized stats preserve an own prototype-named key without changing the prototype / 规范化统计保留自有原型名称键且不改变原型', () => {
    const stats = JSON.parse('{"__proto__":{"first":1,"second":2},"chrome":{"100":50}}')
    const normalized = statsLoader.getStat({ stats }, browserslist.data)
    assert.equal(Object.getPrototypeOf(normalized), null)
    assert.equal(Object.hasOwn(normalized, '__proto__'), true)
    assert.deepEqual(normalized.__proto__, { first: 1, second: 2 })
    assert.equal({}.first, undefined)
  })

  test('auto-discovered stats cannot crash ordinary project resolution / 自动发现的统计不能令普通项目解析崩溃', () => {
    temporary((root) => {
      writeFileSync(join(root, 'browserslist-stats.json'), '{"toString":{"onekey":5},"chrome":{"100":50}}')
      assert.deepEqual(resolve('chrome 100', { path: root, stats: undefined }), ['chrome 100'])
    })
  })

  test('result cache evicts old distinct queries while preserving results / 结果缓存淘汰旧的不同查询且保持结果', () => {
    bounded(`
const original = resolve('chrome 100')
assert.equal(resolve('chrome 100'), original)
for (let index = 1; index <= 600; index++) resolve('since 1900-1-' + index)
const fresh = resolve('chrome 100')
assert.notEqual(fresh, original)
assert.deepEqual(fresh, original)
`)
  })

  test('parse cache evicts old distinct queries while preserving syntax / 解析缓存淘汰旧的不同查询且保持语法', () => {
    bounded(`
const original = browserslist.parse('chrome 100')
assert.equal(browserslist.parse('chrome 100'), original)
for (let index = 1; index <= 600; index++) browserslist.parse('chrome ' + (100 + index))
const fresh = browserslist.parse('chrome 100')
assert.notEqual(fresh, original)
assert.deepEqual(fresh, original)
`)
  })

  test('ordinary target unions, exclusions and custom usage retain expected results / 普通目标并集、排除及自定义使用量保持预期结果', () => {
    assert.deepEqual(resolve(['chrome 100', 'chrome 101', 'not chrome 101']), ['chrome 100'])
    const stats = { dataByBrowser: { chrome: { 100: 75, 101: 25 } } }
    assert.deepEqual(resolve('> 30% in my stats', { stats }), ['chrome 100'])
    assert.equal(browserslist.coverage(['chrome 100'], stats), 75)
  })

  test('project Chrome target resolves once and retains the existing Plasmo target contract / 项目 Chrome 目标解析为单项且保持现有 Plasmo 目标契约', () => {
    const source = readFileSync(require.resolve('plasmo'), 'utf8')
    assert.ok(source.includes('["last 1 Chrome version"]'))
    assert.ok(source.includes('||"es2022"'))
    const targets = resolve('last 1 Chrome version')
    assert.equal(targets.length, 1)
    assert.match(targets[0], /^chrome \d+$/)
  })
}

registerConsumer('Parcel core / Parcel 核心', parcel)
registerConsumer('Inline CSS / 内联 CSS', inlineCss)

nodeTest(
  'actual Parcel target resolution preserves explicit browser engines and emitted code / 实际 Parcel 目标解析保持显式浏览器引擎及生成代码',
  async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-browserslist-parcel-')))
    const previous = process.cwd()
    let cache
    try {
      writeFileSync(join(root, 'index.js'), 'globalThis.fixture = globalThis.input?.nested?.value ?? 7;')
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'synthetic', version: '1.0.0', browserslist: ['chrome 49'] })
      )
      const config = createRequire(plasmo.resolve('@plasmohq/parcel-config'))
      const { Parcel } = plasmo('@parcel/core')
      process.chdir(root)
      // Parcel ends its workers, but the fixture must close its parent LMDB before Windows cleanup. / Parcel 结束工作进程，但夹具须在 Windows 清理前关闭父 LMDB。
      cache = new LMDBCache(join(root, '.parcel-cache'))
      const result = await new Parcel({
        entries: join(root, 'index.js'),
        defaultConfig: config.resolve('@parcel/config-default'),
        cacheDir: join(root, '.parcel-cache'),
        cache,
        mode: 'production',
        shouldAutoInstall: false,
        shouldDisableCache: true,
        defaultTargetOptions: {
          distDir: join(root, 'dist'),
          shouldOptimize: false,
          shouldScopeHoist: false,
          sourceMaps: true
        }
      }).run()
      const bundles = result.bundleGraph.getBundles()
      assert.equal(bundles.length, 1)
      assert.deepEqual(bundles[0].env.engines.browsers, ['chrome 49'])
      const code = readFileSync(bundles[0].filePath, 'utf8')
      assert.equal(code.includes('?.'), false)
      assert.equal(code.includes('??'), false)
      const populated = { input: { nested: { value: 42 } } }
      runInNewContext(code, populated, { timeout: 1000 })
      assert.equal(populated.fixture, 42)
      const missing = {}
      runInNewContext(code, missing, { timeout: 1000 })
      assert.equal(missing.fixture, 7)
    } finally {
      process.chdir(previous)
      if (cache) {
        await cache.store.close()
        assert.equal(cache.store.status, 'closed')
      }
      rmSync(root, { recursive: true, force: true })
    }
  }
)

nodeTest(
  'actual inline CSS transformer preserves target-specific prefixes and dependency handling / 实际内联 CSS 转换器保持目标特定前缀及依赖处理',
  async () => {
    const transformer = inlineCss('@plasmohq/parcel-transformer-inline-css').default[Symbol.for('parcel-plugin-config')]
    let output
    const asset = {
      filePath: join(fixtureRoot, 'style.css'),
      env: { engines: { browsers: ['chrome 49'] }, sourceMap: true },
      meta: { hasDependencies: false },
      getBuffer: async () => Buffer.from('.fixture { user-select: none; color: red; }'),
      getMap: async () => null,
      setBuffer: (value) => {
        output = value
      },
      addDependency: () => assert.fail('Unexpected dependency / 意外依赖'),
      addURLDependency: () => assert.fail('Unexpected URL dependency / 意外 URL 依赖')
    }
    const result = await transformer.transform({ asset, options: { projectRoot: fixtureRoot } })
    assert.equal(result[0], asset)
    assert.match(output.toString(), /-webkit-user-select:\s*none/)
    assert.match(output.toString(), /color:\s*red/)
  }
)
