import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { JSDOM } from 'jsdom'

// Follow the installed parent edges, never a hoisted substitute. / 沿实际父包依赖解析，避免提升后的替代包。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@plasmohq/parcel-transformer-vue']) {
  edge = createRequire(edge.resolve(name))
}
const vue = edge('vue')
const vueRequire = createRequire(edge.resolve('vue'))
const renderer = vueRequire('@vue/server-renderer')
const compiler = edge('@vue/compiler-sfc')
const compilerRequire = createRequire(edge.resolve('@vue/compiler-sfc'))
const ssrCompiler = compilerRequire('@vue/compiler-ssr')
const plugin = edge('@plasmohq/parcel-transformer-vue').default[Symbol.for('parcel-plugin-config')]
const marker = 'synthetic-value / 合成值'
const unsafe = { ['data-owned\rdata-split']: marker }

function assertFiltered(html) {
  assert.doesNotMatch(html, /data-owned|data-split|\r/)
  const dom = new JSDOM(html)
  assert.equal(dom.window.document.querySelector('div').hasAttribute('data-split'), false)
  dom.window.close()
}

test('actual SSR helpers reject CR attribute names / 实际 SSR 辅助函数拒绝含回车属性名', () => {
  assert.equal(renderer.ssrRenderDynamicAttr('data-owned\rdata-split', marker), '')
  assertFiltered(`<div${renderer.ssrRenderAttrs({ id: 'safe', ...unsafe })}></div>`)
})

test('actual Vue renderToString rejects CR attribute names / 实际 Vue renderToString 拒绝含回车属性名', async () => {
  assertFiltered(await renderer.renderToString(vue.createSSRApp({ render: () => vue.h('div', unsafe) })))
})

test('compiled SSR object bindings reject CR attribute names / 编译后 SSR 对象绑定拒绝含回车属性名', async () => {
  const { code } = ssrCompiler.compile('<div v-bind="attrs">{{ text }}</div>', { mode: 'function' })
  const ssrRender = new Function('require', code)(vueRequire)
  const html = await renderer.renderToString(
    vue.createSSRApp({ data: () => ({ attrs: { id: 'safe', ...unsafe }, text: marker }), ssrRender })
  )
  assertFiltered(html)
  assert.match(html, /id="safe"/)
  assert.ok(html.includes(marker))
})

test('ordinary SSR attributes and value escaping remain intact / 普通 SSR 属性及值转义保持完整', async () => {
  const html = await renderer.renderToString(
    vue.createSSRApp({
      render: () => vue.h('div', { id: 'safe', title: '<>&"\'', 'data-owned': marker, hidden: true }, '<owned>')
    })
  )
  assert.match(html, /title="&lt;&gt;&amp;&quot;&#39;"/)
  assert.match(html, / hidden/)
  const dom = new JSDOM(html)
  const div = dom.window.document.querySelector('div')
  assert.equal(div.getAttribute('title'), '<>&"\'')
  assert.equal(div.getAttribute('data-owned'), marker)
  assert.equal(div.textContent, '<owned>')
  assert.equal(div.children.length, 0)
  dom.window.close()
})

const source = `<script setup>const label = 'synthetic / 合成'</script>
<template><div class="owned">{{ label }}</div></template>
<style scoped>.owned { color: red }</style>`
async function transform(pipeline, mode = 'production') {
  const asset = {
    id: 'owned',
    filePath: '/synthetic/owned.vue',
    pipeline,
    env: { sourceMap: false },
    getCode: async () => source
  }
  const options = { mode, projectRoot: '/synthetic', hmrOptions: mode === 'development' ? {} : null }
  const ast = await plugin.parse({ asset, options })
  assert.equal(plugin.canReuseAST({ ast }), true)
  asset.getAST = async () => ast
  return plugin.transform({ asset, options, config: { compilerOptions: {}, customBlocks: {} } })
}

test('actual Plasmo Vue transformer compiles SFC script template and scoped CSS / 实际 Plasmo Vue 转换器编译 SFC 脚本模板及作用域 CSS', async () => {
  const script = await transform('script')
  assert.match(script[0].content, /synthetic \/ 合成/)
  const template = await transform('template')
  assert.match(template[0].content, /export function render/)
  assert.match(template[0].content, /label/)
  const style = await transform('style')
  assert.match(style[0].content, /\.owned\[data-v-/)
  assert.match(style[0].content, /color: red/)
  const glue = await transform(undefined)
  assert.match(glue[0].content, /script\.__scopeId/)
  assert.match(glue[0].content, /template:\.\/owned\.vue/)
})

test('actual Plasmo Vue transformer preserves development HMR / 实际 Plasmo Vue 转换器保留开发热更新', async () => {
  const template = await transform('template', 'development')
  assert.match(template[0].content, /__VUE_HMR_RUNTIME__\.rerender/)
  const glue = await transform(undefined, 'development')
  assert.match(glue[0].content, /__VUE_HMR_RUNTIME__\.reload/)
})

test('actual SFC compiler preserves SSR template compilation / 实际 SFC 编译器保留 SSR 模板编译', () => {
  const { descriptor, errors } = compiler.parse(source, { filename: 'owned.vue' })
  assert.deepEqual(errors, [])
  const script = compiler.compileScript(descriptor, { id: 'owned' })
  const result = compiler.compileTemplate({
    source: descriptor.template.content,
    filename: 'owned.vue',
    id: 'owned',
    ssr: true,
    ssrCssVars: [],
    compilerOptions: { bindingMetadata: script.bindings }
  })
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /ssrRender/)
  assert.match(result.code, /label/)
})
