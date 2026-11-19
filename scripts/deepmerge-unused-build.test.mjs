import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import Module, { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'

// Follow the same actual Parcel consumer as the SVG regressions. / 沿用 SVG 回归中的真实 Parcel 消费者。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@parcel/config-default']) {
  edge = createRequire(edge.resolve(name))
}
const transformerRequire = createRequire(edge.resolve('@parcel/transformer-svg-react'))
const svgrRequire = createRequire(transformerRequire.resolve('@svgr/plugin-svgo'))
const lock = parse(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('only the unused exact-parent deepmerge edge is removed / 仅移除未使用的精确父级 deepmerge 依赖边', () => {
  assert.equal(transformerRequire('@svgr/plugin-svgo/package.json').version, '6.5.1')
  const parents = Object.entries(lock.snapshots).filter(([name]) => name.startsWith('@svgr/plugin-svgo@6.5.1('))
  assert.equal(parents.length, 1)
  assert.equal(Object.hasOwn(parents[0][1].dependencies, 'deepmerge'), false)
  assert.equal(manifest.pnpm.overrides['@svgr/plugin-svgo@6.5.1>deepmerge'], '-')
  assert.equal(lock.overrides['@svgr/plugin-svgo@6.5.1>deepmerge'], '-')
  assert.equal(
    Object.keys(lock.packages).some((name) => name.startsWith('deepmerge@')),
    false
  )
  assert.equal(
    Object.keys(lock.snapshots).some((name) => name.startsWith('deepmerge@')),
    false
  )
  assert.throws(() => svgrRequire.resolve('deepmerge'), { code: 'MODULE_NOT_FOUND' })
})

test('real Parcel and SVGR configs work with deepmerge loading forbidden / 禁止加载 deepmerge 时真实 Parcel 及 SVGR 配置正常工作', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ultraforce-svgr-unused-'))
  const originalLoad = Module._load
  let blocked = 0
  // Intercept requests before resolution, including the deliberately blocked control. / 在解析前拦截请求，包括刻意阻止的对照。
  Module._load = function (request, ...args) {
    if (request === 'deepmerge' || /[/\\]deepmerge[/\\]/.test(request)) {
      blocked++
      throw new Error('DEEPMERGE_LOAD_FORBIDDEN')
    }
    return originalLoad.call(this, request, ...args)
  }
  try {
    assert.throws(() => svgrRequire('deepmerge'), /DEEPMERGE_LOAD_FORBIDDEN/)
    assert.equal(blocked, 1)
    blocked = 0
    const plugin = transformerRequire('@svgr/plugin-svgo')
    const parcel = edge('@parcel/transformer-svg-react').default[Symbol.for('parcel-plugin-config')]
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><title>Owned / 自有</title><rect width="10" height="10" fill="#ff0000"/></svg>'
    const filePath = join(directory, 'owned.svg')
    assert.equal(plugin(source, { svgo: false }, { filePath }), source)
    const ordinary = plugin(source, { svgo: true, runtimeConfig: false, dimensions: false }, { filePath })
    assert.match(ordinary, /viewBox="0 0 24 24"/)
    assert.match(ordinary, /fill="red"/)
    const config = {
      plugins: [{ name: 'addAttributesToSVGElement', params: { attributes: [{ 'data-owned': 'config' }] } }]
    }
    const explicit = plugin(source, { svgo: true, runtimeConfig: false, svgoConfig: config }, { filePath })
    assert.match(explicit, /data-owned="config"/)
    assert.match(explicit, /Owned \/ 自有/)
    await writeFile(join(directory, '.svgorc.json'), JSON.stringify(config))
    assert.match(plugin(source, { svgo: true, runtimeConfig: true }, { filePath }), /data-owned="config"/)
    const requested = []
    const loaded = await parcel.loadConfig({
      config: {
        getConfig: async (names) => {
          requested.push(names)
          return { contents: names.includes('.svgrrc') ? { typescript: true, dimensions: false } : config }
        }
      }
    })
    assert.equal(requested.length, 2)
    let output
    const asset = {
      filePath,
      type: 'svg',
      bundleBehavior: 'isolated',
      getCode: async () => source,
      setCode: (code) => {
        output = code
      }
    }
    const result = await parcel.transform({ asset, config: loaded })
    assert.equal(result[0], asset)
    assert.equal(asset.type, 'tsx')
    assert.equal(asset.bundleBehavior, null)
    assert.match(output, /SVGProps<SVGSVGElement>/)
    assert.match(output, /data-owned="config"/)
    assert.match(output, /viewBox="0 0 24 24"/)
    assert.doesNotMatch(output, /(?:width|height)=(?:"24"|\{24\})/)
    const jsAsset = {
      ...asset,
      setCode: (code) => {
        output = code
      }
    }
    await parcel.transform({ asset: jsAsset, config: { svgr: { svgo: false } } })
    assert.equal(jsAsset.type, 'jsx')
    assert.match(output, /width=\{24\} height=\{24\}/)
    assert.ok(output.includes('Owned / \\u81EA\\u6709'))
    assert.doesNotMatch(output, /SVGProps/)
    assert.equal(blocked, 0, 'Consumers never load deepmerge / 消费者从未加载 deepmerge')
  } finally {
    Module._load = originalLoad
    await rm(directory, { recursive: true, force: true })
  }
})
