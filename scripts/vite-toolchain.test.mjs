import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

// Use Vitest's actual Vite edge, including its mocker peer. / 使用 Vitest 的实际 Vite 依赖边，包括 mocker 的 peer。
const require = createRequire(import.meta.url)
const vitest = createRequire(require.resolve('vitest/package.json'))
const mocker = createRequire(vitest.resolve('@vitest/mocker/package.json'))
const viteEntry = vitest.resolve('vite')
const { build, createServer } = await import(pathToFileURL(viteEntry).href)

async function fixture(run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-vite-toolchain-')))
  try {
    writeFileSync(join(root, 'value.ts'), 'export const value: number = 21\n')
    writeFileSync(join(root, 'entry.ts'), 'import { value } from "./value"\nexport const answer: number = value * 2\n')
    writeFileSync(join(root, 'style.css'), '.fixture { color: red }\n')
    await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('Vitest and its mocker resolve one compatible Vite / Vitest 及其 mocker 解析至同一兼容 Vite', () => {
  assert.equal(mocker.resolve('vite'), viteEntry)
})

test('actual test toolchain transforms TypeScript and loads SSR modules without a listening server / 实际测试工具链无需监听服务器即可转换 TypeScript 并加载 SSR 模块', async () => {
  await fixture(async (root) => {
    const server = await createServer({
      root,
      configFile: false,
      envFile: false,
      publicDir: false,
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] }
    })
    try {
      assert.equal(server.httpServer, null)
      const transformed = await server.transformRequest('/entry.ts')
      assert.ok(transformed)
      assert.doesNotMatch(transformed.code, /: number/)
      assert.match(transformed.code, /value \* 2/)
      assert.equal((await server.ssrLoadModule('/entry.ts')).answer, 42)
    } finally {
      await server.close()
    }
  })
})

test('actual Vite builds TypeScript, CSS and dynamic chunks through the installed graph / 实际 Vite 经已安装依赖图构建 TypeScript、CSS 及动态代码块', async () => {
  await fixture(async (root) => {
    writeFileSync(
      join(root, 'index.html'),
      '<meta charset="utf-8"><title>Fixture / 夹具</title><script type="module" src="/main.ts"></script>'
    )
    writeFileSync(
      join(root, 'main.ts'),
      'import "./style.css"\nimport("./entry").then(({ answer }) => document.body.dataset.answer = String(answer))\n'
    )
    const result = await build({
      root,
      configFile: false,
      envFile: false,
      publicDir: false,
      logLevel: 'silent',
      build: { write: false, minify: false }
    })
    const output = result.output
    assert.ok(output.some((item) => item.type === 'asset' && item.fileName.endsWith('.css')))
    const chunks = output.filter((item) => item.type === 'chunk')
    assert.ok(chunks.some((chunk) => chunk.isEntry))
    assert.ok(chunks.some((chunk) => chunk.isDynamicEntry && chunk.exports.includes('answer')))
    assert.ok(chunks.some((chunk) => chunk.code.includes('value * 2')))
  })
})
