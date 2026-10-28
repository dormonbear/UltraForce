import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import test from 'node:test'

// Resolve the installed Plasmo Vue build edge, never a hoisted substitute. / 解析已安装的 Plasmo Vue 构建边，避免使用提升后的替代包。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@plasmohq/parcel-transformer-vue']) {
  edge = createRequire(edge.resolve(name))
}
const compiler = edge('@vue/compiler-sfc')
const compilerRequire = createRequire(edge.resolve('@vue/compiler-sfc'))
const postcss = compilerRequire('postcss')
const marker = 'owned-source-map-fixture / 自有源码映射夹具'
const css = 'a{color:red}'
const map = {
  version: 3,
  file: 'input.css',
  sources: ['owned.css'],
  sourcesContent: [marker],
  names: [],
  mappings: 'AAAA'
}

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'ultraforce-postcss-'))
  try {
    const input = join(root, 'input')
    mkdirSync(input)
    const target = join(root, 'outside.map')
    writeFileSync(target, JSON.stringify(map))
    return run({ root, input, target, from: join(input, 'input.css') })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function processCSS(annotation, options = {}) {
  return postcss([])
    .process(`${css}\n/*# sourceMappingURL=${annotation} */`, {
      map: { inline: false, annotation: false },
      ...options
    })
    .sync()
}

function assertPrivate(result) {
  assert.equal(JSON.stringify(result.map?.toJSON() ?? null).includes(marker), false)
  assert.ok(result.css.startsWith(css))
}

test('blocks absolute external maps without from / 未指定 from 时阻止绝对路径外部映射', () => {
  fixture(({ target }) => assertPrivate(processCSS(target)))
})

test('blocks relative external maps without from / 未指定 from 时阻止相对路径外部映射', () => {
  fixture(({ target }) => assertPrivate(processCSS(relative(process.cwd(), target))))
})

test('blocks parent traversal with from / 指定 from 时阻止父目录遍历', () => {
  fixture(({ from }) => assertPrivate(processCSS('../outside.map', { from })))
})

test('blocks symlink escape from CSS directory / 阻止符号链接逃离 CSS 目录', () => {
  fixture(({ input, target, from }) => {
    symlinkSync(target, join(input, 'linked.map'))
    assertPrivate(processCSS('linked.map', { from }))
  })
})

test('Vue compileStyle blocks traversing maps with its normal filename / Vue compileStyle 使用正常文件名时阻止遍历映射', () => {
  fixture(({ from }) => {
    const result = compiler.compileStyle({
      source: `${css}\n/*# sourceMappingURL=../outside.map */`,
      filename: from,
      id: 'data-v-owned'
    })
    assert.deepEqual(result.errors, [])
    assert.equal(JSON.stringify(result.map ?? null).includes(marker), false)
    assert.match(result.code, /color:red/)
  })
})

test('ignores unrelated non-map and malformed map inputs without disclosure / 忽略无关非映射及损坏映射且不泄露内容', () => {
  fixture(({ input, from }) => {
    for (const name of ['owned.txt', 'malformed.map']) {
      writeFileSync(join(input, name), marker)
      assertPrivate(processCSS(name, { from }))
    }
  })
})

test('preserves ordinary sibling and inline source maps / 保留普通同目录及内联源码映射', () => {
  fixture(({ input, from }) => {
    writeFileSync(join(input, 'input.css.map'), JSON.stringify(map))
    const inline = `data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
    for (const annotation of ['input.css.map', inline]) {
      assert.ok(JSON.stringify(processCSS(annotation, { from }).map.toJSON()).includes(marker))
    }
  })
})

test('preserves explicitly trusted previous maps / 保留显式信任的先前映射', () => {
  fixture(({ target, from }) => {
    const result = processCSS('ignored.map', { from, map: { prev: () => target, inline: false, annotation: false } })
    assert.ok(JSON.stringify(result.map.toJSON()).includes(marker))
  })
})

test('preserves CSS processing and Vue scoped styles / 保留 CSS 处理及 Vue 作用域样式', () => {
  assert.equal(postcss([]).process(css, { from: undefined, map: false }).css, css)
  const result = compiler.compileStyle({ source: css, filename: 'owned.vue', id: 'data-v-owned', scoped: true })
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /a\[data-v-owned\]/)
  assert.match(result.code, /color:red/)
})
