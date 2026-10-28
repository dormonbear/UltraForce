import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

// Resolve the actual Plasmo/Parcel graph, never a hoisted substitute. / 解析真实 Plasmo／Parcel 依赖图，不使用提升后的替代包。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@parcel/config-default']) {
  edge = createRequire(edge.resolve(name))
}
const parcelRequire = createRequire(edge.resolve('@parcel/optimizer-svgo'))
const htmlRequire = createRequire(edge.resolve('@parcel/optimizer-htmlnano'))
const htmlnanoRequire = createRequire(htmlRequire.resolve('htmlnano'))
const transformerRequire = createRequire(edge.resolve('@parcel/transformer-svg-react'))
const svgrRequire = createRequire(transformerRequire.resolve('@svgr/plugin-svgo'))
const svgNamespace = 'http://www.w3.org/2000/svg'
const options = { plugins: ['removeScriptElement'] }
const parcel = edge('@parcel/optimizer-svgo').default[Symbol.for('parcel-plugin-config')]
const svgr = transformerRequire('@svgr/plugin-svgo')
const svgo = parcelRequire('svgo')
const svg = (contents) => `<svg xmlns="${svgNamespace}">${contents}</svg>`

async function optimize(consumer, source, config = options) {
  if (consumer === 'Parcel') {
    return (await parcel.optimize({ bundle: { env: { shouldOptimize: true } }, contents: source, config })).contents
  }
  if (consumer === 'SVGR') {
    return svgr(source, { svgo: true, runtimeConfig: false, svgoConfig: config }, { filePath: 'synthetic.svg' })
  }
  const result = svgo.optimize(source, config)
  assert.equal(result.error, undefined)
  return result.data
}

// Resource probes run outside the test process under heap/time limits. / 资源探测在测试进程之外运行，并限制堆与时间。
function rejectsEntities(source) {
  const child = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=64',
      '--input-type=module',
      '-e',
      `import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const input = JSON.parse(readFileSync(0, 'utf8'))
const require = createRequire(input.entry)
try {
  const result = require(input.entry).optimize(input.source)
  process.stdout.write(JSON.stringify({ error: result.error ?? null }))
} catch (error) {
  process.stdout.write(JSON.stringify({ error: String(error.message) }))
}`
    ],
    {
      input: JSON.stringify({ entry: parcelRequire.resolve('svgo'), source }),
      encoding: 'utf8',
      timeout: 2500,
      maxBuffer: 64 * 1024
    }
  )
  assert.ifError(child.error)
  assert.equal(child.signal, null, 'Bounded parse returns normally / 受限解析正常返回')
  assert.equal(child.status, 0)
  assert.ok(JSON.parse(child.stdout).error, 'Hostile entities are rejected / 拒绝恶意实体')
}

test('every installed build consumer shares the repaired optimizer / 每个已安装构建调用方均使用同一修复优化器', () => {
  for (const consumer of [htmlRequire, htmlnanoRequire, svgrRequire]) {
    assert.equal(consumer.resolve('svgo'), parcelRequire.resolve('svgo'))
  }
})

test('recursive entities reject within heap and time limits / 递归实体在堆与时间限制内被拒绝', () => {
  rejectsEntities(`<!DOCTYPE svg [<!ENTITY loop "&loop;">]>${svg('<text>&loop;</text>')}`)
})

test('exponential entities reject within heap and time limits / 指数实体在堆与时间限制内被拒绝', () => {
  const entities = ['<!ENTITY e0 "fixture">']
  for (let level = 1; level <= 8; level++) {
    entities.push(`<!ENTITY e${level} "${`&e${level - 1};`.repeat(10)}">`)
  }
  rejectsEntities(`<!DOCTYPE svg [${entities.join('')}]>${svg('<text>&e8;</text>')}`)
})

// Script removal is explicitly enabled; default optimization is not sanitization. / 显式启用脚本移除；默认优化并非消毒。
for (const consumer of ['SVGO', 'Parcel', 'SVGR']) {
  test(`${consumer} removes scripts and event handlers with opt-in policy / 显式策略移除脚本及事件处理器`, async () => {
    const result = await optimize(consumer, svg('<script>fixture()</script><rect onload="fixture()" width="10"/>'))
    assert.doesNotMatch(result, /script|onload|fixture\(\)/i)
    assert.match(result, /rect/)
  })

  test(`${consumer} removes executable foreignObject attributes / 移除 foreignObject 可执行属性`, async () => {
    const result = await optimize(
      consumer,
      svg(
        '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml" onbeforetoggle="fixture()"><iframe srcdoc="&lt;script&gt;fixture()&lt;/script&gt;"/><form action="javascript:fixture()"><button formaction="javascript:fixture()">Visible</button></form></div></foreignObject>'
      )
    )
    assert.doesNotMatch(result, /onbeforetoggle|srcdoc|javascript:|fixture\(\)/i)
    assert.match(result, /foreignObject/)
    assert.match(result, /Visible/)
  })

  test(`${consumer} removes namespace and control-character executable links / 移除命名空间及控制字符可执行链接`, async () => {
    const result = await optimize(
      consumer,
      svg(
        `<s:a xmlns:s="${svgNamespace}" href="javascript:fixture()"><text>Namespace</text></s:a><a href="java&#9;script:fixture()"><text>Tab</text></a><a href="java&#10;script:fixture()"><text>Newline</text></a>`
      )
    )
    assert.doesNotMatch(result, /fixture\(\)|href=/)
    assert.match(result, /Namespace/)
    assert.match(result, /Tab/)
  })

  test(`${consumer} preserves safe links, custom namespaces and visual HTML / 保留安全链接、自定义命名空间及可视 HTML`, async () => {
    const result = await optimize(
      consumer,
      svg(
        '<a href="https://example.invalid/safe"><text>Safe</text></a><custom:a xmlns:custom="urn:synthetic" href="javascript:custom-data">Custom</custom:a><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" class="label">Visible</div></foreignObject>'
      )
    )
    assert.match(result, /https:\/\/example\.invalid\/safe/)
    assert.match(result, /custom:a/)
    assert.match(result, /javascript:custom-data/)
    assert.match(result, /class="label"/)
    assert.match(result, /Visible/)
  })
}

test('ordinary SVG optimization and predefined entities remain compatible / 普通 SVG 优化及预定义实体保持兼容', async () => {
  const source = svg('<title>Fixture &amp; compatibility</title><rect x="0" y="0" width="10" height="10"/>')
  const result = await optimize('SVGO', source, { plugins: [] })
  assert.match(result, /Fixture &amp; compatibility/)
  assert.match(result, /rect/)
  const defaultResult = await optimize('Parcel', svg('<rect width="10" height="10"/>'), {})
  assert.match(defaultResult, /<svg/)
})
