import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('production search content script includes the React JSX runtime / 正式构建的搜索内容脚本包含 React JSX 运行时', () => {
  const build = new URL('../build/chrome-mv3-prod/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', build), 'utf8'))
  const searchScript = manifest.content_scripts
    .flatMap(({ js }) => js ?? [])
    .find((file) => /^salesforce-search(?:\.[^/]+)?\.js$/.test(file))
  assert.ok(searchScript, 'Search content script missing from manifest / 清单缺少搜索内容脚本')

  const bundle = readFileSync(new URL(searchScript, build), 'utf8')
  assert.match(bundle, /\.jsx\s*=/, 'React jsx export missing / 缺少 React jsx 导出')
  assert.match(bundle, /\.jsxs\s*=/, 'React jsxs export missing / 缺少 React jsxs 导出')
})
