import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

// Follow both installed Sass consumers rather than a separate test dependency. / 沿两个已安装 Sass 调用方解析，不另装测试依赖。
const require = createRequire(import.meta.url)
let parcel = require
for (const name of ['plasmo', '@plasmohq/parcel-config', '@parcel/config-default', '@parcel/transformer-sass']) {
  parcel = createRequire(parcel.resolve(name))
}
const vite = createRequire(require.resolve('vite'))
const sassEntry = parcel.resolve('sass')
const sassRequire = createRequire(sassEntry)
const immutableEntry = sassRequire.resolve('immutable')
const immutable = sassRequire('immutable')
const sass = parcel('sass')

// Upstream behavior: GHSA-wf6x-7x77-mvgw, GHSA-xvcm-6775-5m9r, GHSA-v56q-mh7h-f735. / 上游行为公告见这些编号。
// Bound resource probes outside the test runner; only synthetic data is used. / 在测试运行器之外限制资源探测，仅使用合成数据。
function bounded(source, timeout = 4000) {
  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=96',
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { List, Map, Set, fromJS, hash } = require(process.argv[1])
${source}
process.stdout.write('ok')`,
      immutableEntry
    ],
    { encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 }
  )
  assert.ifError(result.error)
  assert.equal(result.signal, null, 'Probe completes normally / 探测正常完成')
  assert.equal(result.status, 0, result.stderr.slice(0, 1500))
  assert.equal(result.stdout, 'ok')
}

test('Parcel and Vite share the installed Sass and Immutable edges / Parcel 及 Vite 共用已安装的 Sass 和 Immutable 依赖边', () => {
  assert.equal(vite.resolve('sass'), sassEntry)
  assert.equal(createRequire(vite.resolve('sass')).resolve('immutable'), immutableEntry)
})

for (const [name, convert] of [
  ['merge', (value) => immutable.merge({ name: 'fixture' }, value)],
  ['mergeDeep', (value) => immutable.mergeDeep({ name: 'fixture' }, value)],
  ['mergeDeepWith', (value) => immutable.mergeDeepWith((_left, right) => right, { name: 'fixture' }, value)],
  ['Map.toJS', (value) => immutable.Map(value).toJS()],
  ['Map.toObject', (value) => immutable.Map(value).toObject()]
]) {
  test(`${name} rejects unsafe keys without inherited injected values / 拒绝危险键且不继承注入值`, () => {
    const input = JSON.parse('{"__proto__":{"injected":"synthetic"},"constructor":"ordinary","name":"safe"}')
    const result = convert(input)
    assert.equal(result.injected, undefined)
    assert.equal(Object.hasOwn(result, '__proto__'), false)
    assert.equal(Object.hasOwn(result, 'constructor'), false)
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.name, 'safe')
    assert.equal({}.injected, undefined)
  })
}

test('nested merge rejects unsafe prototype keys / 嵌套合并拒绝危险原型键', () => {
  const result = immutable.mergeDeep(
    { profile: { label: 'fixture' } },
    JSON.parse('{"profile":{"__proto__":{"injected":true}}}')
  )
  assert.equal(result.profile.injected, undefined)
  assert.equal(result.profile.label, 'fixture')
  assert.equal(Object.hasOwn(result.profile, '__proto__'), false)
  assert.equal(Object.getPrototypeOf(result.profile), Object.prototype)
})

for (const [name, operation] of [
  ['empty List.set', 'List().set(2 ** 30, "x")'],
  ['populated List.setIn', 'fromJS({ items: Array(64).fill(0) }).setIn(["items", "1073741824"], "x")'],
  ['List.updateIn', 'List().updateIn([2 ** 30], () => "x")'],
  ['List.setSize signed overflow', 'List([1, 2, 3]).setSize(2 ** 31)'],
  ['List.setSize unsigned wrap', 'List([1, 2, 3]).setSize(2 ** 32 + 5)']
]) {
  test(`${name} rejects oversized bounds without hanging or truncation / 拒绝超大边界且不挂起或截断`, () => {
    bounded(`assert.throws(() => ${operation}, RangeError)`)
  })
}

for (const collection of ['Map', 'Set']) {
  test(`${collection} bulk/transient build and reads handle colliding strings within resource bounds / 批量临时构建及读取在资源限制内处理碰撞字符串`, () => {
    bounded(`
const keys = Array.from({ length: 32768 }, (_, number) =>
  number.toString(2).padStart(15, '0').replaceAll('0', 'Aa').replaceAll('1', 'BB'))
assert.equal(new globalThis.Set(keys.map(hash)).size, 1)
const value = ${collection}().withMutations((mutable) => {
  for (let index = 0; index < keys.length; index++) mutable.${collection === 'Map' ? 'set(keys[index], index)' : 'add(keys[index])'}
})
assert.equal(value.size, keys.length)
for (let index = 0; index < keys.length; index++) assert.equal(value.${collection === 'Map' ? 'get(keys[index]), index' : 'has(keys[index]), true'})
const changed = value.delete(keys[1])
assert.equal(changed.has(keys[1]), false)
assert.equal(value.has(keys[1]), true)
`)
  })
}

test('ordinary immutable collections retain persistent updates and equality / 普通不可变集合保持持久更新及相等语义', () => {
  const original = immutable.fromJS({ items: [1, 2, 3], options: { color: 'red' } })
  const changed = original.setIn(['items', 1], 42)
  assert.deepEqual(original.get('items').toArray(), [1, 2, 3])
  assert.deepEqual(changed.get('items').toArray(), [1, 42, 3])
  assert.ok(immutable.is(original, immutable.fromJS(original.toJS())))
  assert.deepEqual(immutable.List([1, 2]).unshift(0).push(3).slice(1, Infinity).toArray(), [1, 2, 3])
})

const scss =
  '@use "sass:map"; $theme: (accent: #123456, spacing: (small: 2px)); .fixture { color: map.get($theme, accent); padding: map.get($theme, spacing, small); }'

test('actual Parcel Sass transformer preserves compiled maps and source maps / 实际 Parcel Sass 转换器保持编译映射及源码映射', async () => {
  const transformer = parcel('@parcel/transformer-sass').default[Symbol.for('parcel-plugin-config')]
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-immutable-parcel-')))
  try {
    let css
    let sourceMap
    const asset = {
      filePath: join(root, 'style.scss'),
      type: 'scss',
      getCode: async () => scss,
      setCode: (value) => {
        css = String(value)
      },
      setMap: (value) => {
        sourceMap = value
      },
      invalidateOnFileChange: () => {}
    }
    const options = { projectRoot: root, env: {} }
    const config = await transformer.loadConfig({ config: { getConfig: async () => null }, options })
    config.silenceDeprecations = ['legacy-js-api']
    const result = await transformer.transform({ asset, options, config })
    assert.equal(result[0], asset)
    assert.equal(asset.type, 'css')
    assert.match(css, /color: #123456/)
    assert.match(css, /padding: 2px/)
    assert.ok(sourceMap.getSources().some((source) => source.endsWith('style.scss')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('actual Sass preserves maps, custom values and source maps / 实际 Sass 保持映射、自定义值及源码映射', () => {
  const result = sass.compileString(scss, { sourceMap: true, url: new URL('file:///synthetic.scss') })
  assert.match(result.css, /color: #123456/)
  assert.match(result.css, /padding: 2px/)
  assert.ok(result.sourceMap.sources.some((source) => source.endsWith('/synthetic.scss')))
  const custom = sass.compileString('.fixture { color: fixture-color(); }', {
    functions: {
      'fixture-color()': () =>
        new sass.SassMap(
          immutable.OrderedMap([[new sass.SassString('accent'), new sass.SassColor({ red: 18, green: 52, blue: 86 })]])
        ).contents.get(new sass.SassString('accent'))
    }
  })
  assert.match(custom.css, /color: #123456/)
})

test('actual Vite compiles Sass maps through its installed parent edge / 实际 Vite 经已安装父依赖编译 Sass 映射', async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite')).href)
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-immutable-sass-')))
  try {
    writeFileSync(join(root, 'index.html'), '<link rel="stylesheet" href="./style.scss">')
    writeFileSync(join(root, 'style.scss'), scss)
    const result = await build({
      root,
      configFile: false,
      envFile: false,
      publicDir: false,
      logLevel: 'silent',
      css: { preprocessorOptions: { scss: { api: 'modern' } } },
      build: { write: false, minify: false, cssMinify: false }
    })
    const css = result.output.find((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
    assert.ok(css)
    assert.match(String(css.source), /color: #123456/)
    assert.match(String(css.source), /padding: 2px/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
