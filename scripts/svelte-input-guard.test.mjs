import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-svelte-input-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(new URL('./check-svelte-inputs.mjs', import.meta.url), join(root, 'scripts', 'check-svelte-inputs.mjs'))
  return root
}

function write(root, path, contents) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

function run(root, nodeArgs = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, join(root, 'scripts', 'check-svelte-inputs.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  return result
}

function linkOrSkip(t, target, path, type) {
  try {
    symlinkSync(target, path, type)
    return true
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) {
      t.skip('Windows symbolic-link creation requires privileges / Windows 创建符号链接需要权限')
      return false
    }
    throw error
  }
}

function packageFixture(root, path, name, main = 'index.js') {
  write(root, `${path}/package.json`, JSON.stringify({ name, version: '0.42.0', main }))
  write(root, `${path}/index.js`, 'module.exports = {}')
}

test('ordinary inputs and generated Svelte files pass without the transformer / 普通输入和生成的 Svelte 文件在没有转换器时通过', (t) => {
  const root = fixture(t)
  write(root, 'src/components/example.tsx', 'export const owned = true')
  write(root, 'node_modules/unrelated/example.svelte', '<p>Generated / 生成</p>')
  write(root, 'build/example.svelte', '<p>Generated / 生成</p>')
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test('a new untracked source fails clearly until the transformer is restored / 新的未跟踪源文件在恢复转换器前明确失败', (t) => {
  const root = fixture(t)
  const init = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' })
  assert.ifError(init.error)
  assert.equal(init.status, 0, init.stderr)
  write(root, 'src/components/owned.svelte', '<p>Owned / 自有</p>')
  const status = spawnSync('git', ['status', '--short', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
  assert.equal(status.status, 0, status.stderr)
  assert.match(status.stdout, /\?\? src\/components\/owned\.svelte/)
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /owned\.svelte/)
  assert.match(result.stderr, /requires restoring the Parcel Svelte transformer/)
  assert.match(result.stderr, /需要恢复 Parcel Svelte 转换器/)
})

test('an unrelated hoisted transformer does not satisfy the Parcel config edge / 无关的提升转换器不能满足 Parcel 配置依赖边', (t) => {
  const root = fixture(t)
  write(root, 'src/owned.svelte', '<p>Owned / 自有</p>')
  packageFixture(root, 'node_modules/plasmo', 'plasmo')
  packageFixture(root, 'node_modules/plasmo/node_modules/@plasmohq/parcel-config', '@plasmohq/parcel-config')
  packageFixture(root, 'node_modules/@plasmohq/parcel-transformer-svelte', '@plasmohq/parcel-transformer-svelte')
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires restoring the Parcel Svelte transformer/)
})

test('a restored direct transformer allows Svelte input and a broken package does not / 恢复的直接转换器允许 Svelte 输入而损坏的包不允许', (t) => {
  const root = fixture(t)
  write(root, 'src/owned.svelte', '<p>Owned / 自有</p>')
  packageFixture(root, 'node_modules/plasmo', 'plasmo')
  packageFixture(root, 'node_modules/plasmo/node_modules/@plasmohq/parcel-config', '@plasmohq/parcel-config')
  const direct = 'node_modules/plasmo/node_modules/@plasmohq/parcel-transformer-svelte'
  write(
    root,
    `${direct}/package.json`,
    JSON.stringify({ name: '@plasmohq/parcel-transformer-svelte', main: 'missing.js' })
  )
  assert.equal(run(root).status, 1)
  packageFixture(root, direct, '@plasmohq/parcel-transformer-svelte')
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test('a stale direct package does not override an active removal rule / 过期的直接包不会覆盖仍生效的移除规则', (t) => {
  const root = fixture(t)
  write(root, 'src/owned.svelte', '<p>Owned / 自有</p>')
  packageFixture(root, 'node_modules/plasmo', 'plasmo')
  packageFixture(root, 'node_modules/plasmo/node_modules/@plasmohq/parcel-config', '@plasmohq/parcel-config')
  packageFixture(
    root,
    'node_modules/plasmo/node_modules/@plasmohq/parcel-transformer-svelte',
    '@plasmohq/parcel-transformer-svelte'
  )
  const override = '@plasmohq/parcel-config@0.42.0>@plasmohq/parcel-transformer-svelte'
  write(root, 'package.json', JSON.stringify({ pnpm: { overrides: { [override]: '-' } } }))
  const blocked = run(root)
  assert.equal(blocked.status, 1)
  assert.match(blocked.stderr, /requires restoring the Parcel Svelte transformer/)
  write(root, 'package.json', JSON.stringify({ pnpm: { overrides: {} } }))
  assert.equal(run(root).status, 0)
})

test('removing the override without reinstalling cannot silently skip Svelte regressions / 删除覆盖但未重新安装时不能悄然跳过 Svelte 回归', (t) => {
  const root = fixture(t)
  packageFixture(root, 'node_modules/plasmo', 'plasmo')
  packageFixture(root, 'node_modules/plasmo/node_modules/@plasmohq/parcel-config', '@plasmohq/parcel-config')
  write(root, 'package.json', JSON.stringify({ pnpm: { overrides: {} } }))
  copyFileSync(
    new URL('./svelte-build-inputs.test.mjs', import.meta.url),
    join(root, 'scripts', 'svelte-build-inputs.test.mjs')
  )
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', 'scripts/svelte-build-inputs.test.mjs'], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 10000
  })
  assert.ifError(result.error)
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout + result.stderr, /Svelte transformer must be restored/)
})

test('an unrelated dangling link does not block a build / 无关的悬空链接不会阻止构建', (t) => {
  const root = fixture(t)
  write(root, 'src/ordinary.ts', 'export const owned = true')
  if (!linkOrSkip(t, 'missing.txt', join(root, 'src', 'dangling-link'), 'file')) return
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test('a self-referential link does not block a build / 自引用链接不会阻止构建', (t) => {
  const root = fixture(t)
  write(root, 'src/ordinary.ts', 'export const owned = true')
  if (!linkOrSkip(t, 'loop-link', join(root, 'src', 'loop-link'), 'file')) return
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test('a linked Svelte file still requires the transformer / 链接的 Svelte 文件仍需要转换器', (t) => {
  const root = fixture(t)
  write(root, 'src/owned.txt', '<p>Owned / 自有</p>')
  if (!linkOrSkip(t, 'owned.txt', join(root, 'src', 'linked.svelte'), 'file')) return
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /linked\.svelte/)
  assert.match(result.stderr, /requires restoring the Parcel Svelte transformer/)
})

test('a dangling Svelte-named link still requires the transformer / 以 Svelte 命名的悬空链接仍需要转换器', (t) => {
  const root = fixture(t)
  mkdirSync(join(root, 'src'), { recursive: true })
  if (!linkOrSkip(t, 'missing.txt', join(root, 'src', 'missing.svelte'), 'file')) return
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing\.svelte/)
  assert.match(result.stderr, /requires restoring the Parcel Svelte transformer/)
})

test('an in-project linked directory exposes its Svelte input / 项目内链接目录会暴露其中的 Svelte 输入', (t) => {
  const root = fixture(t)
  write(root, 'build/owned/inside.svelte', '<p>Owned / 自有</p>')
  mkdirSync(join(root, 'src'), { recursive: true })
  if (!linkOrSkip(t, join(root, 'build', 'owned'), join(root, 'src', 'linked'), 'dir')) return
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /inside\.svelte/)
  assert.match(result.stderr, /requires restoring the Parcel Svelte transformer/)
})

test('an external linked directory remains outside the scan / 项目外的链接目录仍不在扫描范围内', (t) => {
  const root = fixture(t)
  const external = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-svelte-external-')))
  t.after(() => rmSync(external, { recursive: true, force: true }))
  write(external, 'owned.svelte', '<p>Owned / 自有</p>')
  mkdirSync(join(root, 'src'), { recursive: true })
  if (!linkOrSkip(t, external, join(root, 'src', 'external'), 'dir')) return
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test('unexpected symlink filesystem errors still fail the guard / 意外的符号链接文件系统错误仍使保护检查失败', (t) => {
  const root = fixture(t)
  write(root, 'src/owned.txt', 'Owned / 自有')
  const link = join(root, 'src', 'permission-link')
  if (!linkOrSkip(t, 'owned.txt', link, 'file')) return
  write(
    root,
    'inject-stat-error.cjs',
    `const fs = require('node:fs'); const original = fs.statSync; fs.statSync = (path, ...args) => { if (path === ${JSON.stringify(link)}) { const error = new Error('EACCES: owned symlink stat / 自有符号链接状态读取被拒绝'); error.code = 'EACCES'; throw error } return original(path, ...args) }; require('node:module').syncBuiltinESMExports()`
  )
  const result = run(root, ['--require', join(root, 'inject-stat-error.cjs')])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EACCES: owned symlink stat/)
})
