import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { devNull, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const formatter = join(dirname(require.resolve('oxfmt/package.json')), 'bin', 'oxfmt')
const projectFile = (name) => readFileSync(new URL(`../${name}`, import.meta.url))

function checkout(run) {
  const root = mkdtempSync(join(tmpdir(), 'ultraforce-checkout-newlines-'))
  const output = join(root, 'checkout')
  const files = {
    '.editorconfig': projectFile('.editorconfig'),
    '.oxfmtrc.json': projectFile('.oxfmtrc.json'),
    'src/probe.ts': Buffer.from("export const value = 'synthetic / 合成'\n"),
    'patches/manifest.patch': projectFile('patches/@plasmohq__parcel-transformer-manifest@0.21.1.patch'),
    'patches/cache.patch': projectFile('patches/http-cache-semantics@4.2.0.patch'),
    'assets/icon.png': projectFile('assets/icon.png')
  }
  const attributes = new URL('../.gitattributes', import.meta.url)
  if (existsSync(attributes)) files['.gitattributes'] = readFileSync(attributes)
  try {
    // Scope Windows-style conversion to this fixture; never change user Git configuration. / Windows 式换行转换仅限本夹具，不修改用户 Git 配置。
    const git = (...args) => {
      const result = spawnSync(
        'git',
        ['-c', 'core.autocrlf=true', '-c', 'core.eol=crlf', '-c', `core.attributesfile=${devNull}`, ...args],
        { cwd: root, encoding: 'utf8', timeout: 10000 }
      )
      assert.ifError(result.error)
      assert.equal(result.status, 0, result.stdout + result.stderr)
    }
    git('init', '--quiet')
    for (const [name, bytes] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true })
      writeFileSync(join(root, name), bytes)
    }
    git('add', '--', ...Object.keys(files))
    mkdirSync(output)
    git(`--work-tree=${output}`, 'checkout-index', '--all', '--force')
    run(output, files)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('Git checkout with Windows newline defaults passes the unchanged source formatter / Windows 默认换行检出通过原有源码格式检查', () => {
  checkout((output) => {
    const result = spawnSync(process.execPath, [formatter, '--check', 'src'], {
      cwd: output,
      encoding: 'utf8',
      timeout: 10000
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
})

test('Git checkout preserves exact LF source and both frozen patch bytes / Git 检出保留准确 LF 源码及两项冻结补丁字节', () => {
  checkout((output, files) => {
    for (const name of ['src/probe.ts', 'patches/manifest.patch', 'patches/cache.patch']) {
      assert.deepEqual(readFileSync(join(output, name)), files[name], name)
    }
  })
})

test('Git newline policy preserves actual PNG binary bytes / Git 换行策略保留实际 PNG 二进制字节', () => {
  checkout((output, files) => {
    assert.deepEqual(readFileSync(join(output, 'assets/icon.png')), files['assets/icon.png'])
  })
})
