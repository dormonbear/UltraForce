import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

// Follow the installed transformer edge, never a hoisted substitute. / 沿已安装转换器依赖边解析，避免提升后的替代包。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@plasmohq/parcel-transformer-svelte']) {
  edge = createRequire(edge.resolve(name))
}
const compiler = edge('svelte/compiler')
const plugin = edge('@plasmohq/parcel-transformer-svelte').default[Symbol.for('parcel-plugin-config')]
const jsdomRequire = createRequire(createRequire(import.meta.url).resolve('jsdom'))
const parse5 = await import(pathToFileURL(jsdomRequire.resolve('parse5')).href)
const marker = '</noscript><span data-owned="sentinel">owned / 自有</span>'
const ssrSource =
  '<script>export let value;</script><noscript><span data-value={value}>fallback / 后备</span></noscript><p>after / 之后</p>'

function elements(html, scriptingEnabled = true) {
  const result = []
  const visit = (node) => {
    if (node.tagName) result.push(node)
    for (const child of node.childNodes || []) visit(child)
  }
  visit(parse5.parseFragment(html, { scriptingEnabled }))
  return result
}

async function render(code, props) {
  const root = await fs.mkdtemp(join(tmpdir(), 'ultraforce-svelte-'))
  try {
    // Evaluate only our authored compiler output; props remain data. / 仅求值自编夹具的编译结果；属性始终作为数据传入。
    const file = join(root, 'owned.mjs')
    const internal = pathToFileURL(edge.resolve('svelte/internal')).href
    await fs.writeFile(file, code.replaceAll('"svelte/internal"', JSON.stringify(internal)))
    const { default: component } = await import(pathToFileURL(file).href)
    return component.render(props).html
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

function assertContained(html) {
  assert.equal(
    elements(html).some((node) => node.attrs.some((attr) => attr.name === 'data-owned')),
    false
  )
  assert.deepEqual(
    elements(html).map((node) => node.tagName),
    ['noscript', 'p']
  )
  assert.match(html, /&lt;\/noscript>/)
}

test('SSR noscript dynamic attributes keep harmless markup as data / SSR noscript 动态属性将无害标记保留为数据', async () => {
  const result = compiler.compile(ssrSource, { filename: 'owned.svelte', generate: 'ssr' })
  assertContained(await render(result.js.code, { value: marker }))
})

test('SSR noscript spread attributes keep harmless markup as data / SSR noscript 展开属性将无害标记保留为数据', async () => {
  const result = compiler.compile(
    '<script>export let attrs;</script><noscript><span {...attrs}>fallback / 后备</span></noscript><p>after / 之后</p>',
    {
      filename: 'owned.svelte',
      generate: 'ssr'
    }
  )
  assertContained(await render(result.js.code, { attrs: { 'data-value': marker } }))
})

test('ordinary SSR text and attributes preserve escaping / 普通 SSR 文本及属性保持转义', async () => {
  const result = compiler.compile('<script>export let value;</script><div title={value}>{value}</div>', {
    filename: 'owned.svelte',
    generate: 'ssr'
  })
  const value = '<owned>&" / 自有'
  const html = await render(result.js.code, { value })
  const nodes = elements(html)
  assert.deepEqual(
    nodes.map((node) => node.tagName),
    ['div']
  )
  assert.equal(nodes[0].attrs.find((attr) => attr.name === 'title').value, value)
  assert.equal(nodes[0].childNodes[0].value, value)
  assert.match(html, /&amp;/)
  assert.match(html, /&quot;/)
  assert.match(html, /&lt;owned>/)
})

test('valid noscript fallback remains readable with scripting disabled / 禁用脚本时有效 noscript 后备内容仍可读取', async () => {
  const result = compiler.compile(ssrSource, { filename: 'owned.svelte', generate: 'ssr' })
  const html = await render(result.js.code, { value: 'ordinary & " / 普通' })
  assert.deepEqual(
    elements(html, false).map((node) => node.tagName),
    ['noscript', 'span', 'p']
  )
  assert.equal(elements(html, false)[1].attrs[0].value, 'ordinary & " / 普通')
})

const source =
  '<script>export let label = "owned / 自有";</script><p class="owned">{label}</p><style>.owned { color: red }</style>'
async function transform(mode, compilerOptions = {}, preprocess, invalidated = []) {
  const root = join(tmpdir(), 'ultraforce-svelte-owned')
  const config = await plugin.loadConfig({
    config: { getConfig: async () => null },
    options: { mode }
  })
  const warnings = []
  const asset = {
    id: 'owned',
    filePath: join(root, 'owned.svelte'),
    meta: {},
    getCode: async () => source,
    getMap: async () => null,
    invalidateOnFileChange: (file) => invalidated.push(file)
  }
  const output = await plugin.transform({
    asset,
    config: { ...config, preprocess, compilerOptions: { ...config.compilerOptions, ...compilerOptions } },
    options: { mode, projectRoot: root },
    logger: { warn: (warning) => warnings.push(warning) }
  })
  assert.deepEqual(warnings, [])
  return output
}

test('ordinary DOM compiler preserves JS CSS and source maps / 普通 DOM 编译器保留 JS CSS 及源码映射', () => {
  const result = compiler.compile(source, { filename: 'owned.svelte', css: 'external', dev: false })
  assert.match(result.js.code, /class Owned extends SvelteComponent/)
  assert.match(result.css.code, /color:red/)
  assert.ok(result.js.map.sources.some((name) => name.endsWith('owned.svelte')))
  assert.equal(result.js.map.sourcesContent[0], source)
  assert.equal(result.css.map.sourcesContent[0], source)
})

test('actual Plasmo production transformer preserves injected CSS and source maps / 实际 Plasmo 正式转换器保留注入 CSS 及源码映射', async () => {
  const output = await transform('production')
  assert.deepEqual(
    output.map((item) => item.type),
    ['js', 'css']
  )
  assert.match(output[0].content, /append_styles/)
  assert.match(output[0].content, /color:red/)
  assert.equal(output[0].uniqueKey, 'owned-js')
  assert.ok(output[0].map.getMap().sources.some((name) => name.endsWith('owned.svelte')))
})

test('actual Plasmo development transformer preserves dev validation and external CSS / 实际 Plasmo 开发转换器保留开发验证及外部 CSS', async () => {
  const output = await transform('development', { css: 'external' })
  assert.deepEqual(
    output.map((item) => item.type),
    ['js', 'css']
  )
  assert.match(output[0].content, /SvelteComponentDev/)
  assert.match(output[1].content, /color:\s*red/)
  for (const item of output) assert.ok(item.map.getMap().sources.some((name) => name.endsWith('owned.svelte')))
})

test('actual Plasmo transformer preserves preprocessing and dependency invalidation / 实际 Plasmo 转换器保留预处理及依赖失效通知', async () => {
  const dependency = join(tmpdir(), 'ultraforce-svelte-owned', 'owned-input.txt')
  const invalidated = []
  const output = await transform(
    'production',
    {},
    {
      markup: ({ content }) => ({
        code: content.replace('owned / 自有', 'preprocessed / 预处理'),
        dependencies: [dependency]
      })
    },
    invalidated
  )
  assert.deepEqual(invalidated, [dependency])
  assert.match(output[0].content, /preprocessed \/ 预处理/)
})

test('actual Plasmo transformer preserves SSR compiler configuration / 实际 Plasmo 转换器保留 SSR 编译器配置', async () => {
  const output = await transform('production', { generate: 'ssr' })
  const html = await render(output[0].content, { label: '<owned> / 自有' })
  assert.deepEqual(
    elements(html).map((node) => node.tagName),
    ['p']
  )
  assert.equal(elements(html)[0].childNodes[0].value, '<owned> / 自有')
})
