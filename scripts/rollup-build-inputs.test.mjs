import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'

// Follow the installed Plasmo resolver's tsup edge. / 沿实际 Plasmo 解析器的 tsup 依赖路径解析。
let consumer = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@plasmohq/parcel-resolver-post', 'tsup']) {
  consumer = createRequire(consumer.resolve(name))
}
const { rollup } = consumer('rollup')
const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-rollup-')))
after(() => rmSync(root, { recursive: true, force: true }))
let sequence = 0

function fixture() {
  const directory = join(root, String(sequence++))
  mkdirSync(directory)
  const input = join(directory, 'input.js')
  writeFileSync(input, 'export const answer = 42;')
  const sentinel = join(directory, 'sentinel.js')
  writeFileSync(sentinel, 'synthetic sentinel')
  return { directory, input, sentinel, output: join(directory, 'dist') }
}

for (const mode of ['entry', 'bundle-key', 'fileName', 'absolute']) {
  test(`installed Rollup rejects escaping ${mode} and preserves the fixture sentinel / 已安装 Rollup 拒绝越界 ${mode} 并保留夹具哨兵`, async () => {
    const { input, sentinel, output } = fixture()
    const fileName = mode === 'absolute' ? sentinel : 'nested/../../sentinel.js'
    const bundle = await rollup({
      input,
      plugins:
        mode === 'entry'
          ? []
          : [
              {
                name: 'synthetic-output',
                generateBundle(_options, files) {
                  files[mode === 'fileName' ? 'safe.js' : fileName] = {
                    type: 'asset',
                    fileName,
                    source: 'synthetic output'
                  }
                }
              }
            ]
    })
    try {
      const error = await bundle
        .write({ dir: output, format: 'es', entryFileNames: mode === 'entry' ? fileName : '[name].js' })
        .then(
          () => null,
          (error) => error
        )
      assert.equal(readFileSync(sentinel, 'utf8'), 'synthetic sentinel')
      assert.equal(error?.code, 'FILE_NAME_OUTSIDE_OUTPUT_DIRECTORY')
    } finally {
      await bundle.close()
    }
  })
}

test('named input traversal is rejected inside the owned fixture / 在自有夹具内拒绝命名入口越界', async () => {
  const { input, sentinel, output } = fixture()
  const bundle = await rollup({ input: { 'nested/../../sentinel': input } })
  try {
    const error = await bundle.write({ dir: output, format: 'es' }).then(
      () => null,
      (error) => error
    )
    assert.equal(readFileSync(sentinel, 'utf8'), 'synthetic sentinel')
    assert.equal(error?.code, 'FILE_NAME_OUTSIDE_OUTPUT_DIRECTORY')
  } finally {
    await bundle.close()
  }
})

for (const fileName of ['nested/asset.txt', './asset.txt', '..prefix.txt', 'nested/deeper/../asset.txt']) {
  test(`valid normalized output remains writable: ${fileName} / 有效规范化产物仍可写入`, async () => {
    const { input, sentinel, output } = fixture()
    const bundle = await rollup({
      input,
      plugins: [
        {
          name: 'synthetic-asset',
          generateBundle(_options, files) {
            files[fileName] = { type: 'asset', fileName, source: 'synthetic asset' }
          }
        }
      ]
    })
    try {
      await bundle.write({ dir: output, format: 'es' })
      assert.equal(readFileSync(join(output, fileName), 'utf8'), 'synthetic asset')
      assert.match(readFileSync(join(output, 'input.js'), 'utf8'), /answer/)
      assert.equal(readFileSync(sentinel, 'utf8'), 'synthetic sentinel')
    } finally {
      await bundle.close()
    }
  })
}

test('actual tsup uses Rollup for treeshaking and declaration bundling / 实际 tsup 使用 Rollup 进行摇树及声明打包', () => {
  const { directory } = fixture()
  mkdirSync(join(directory, 'node_modules'))
  symlinkSync(
    dirname(consumer.resolve('typescript/package.json')),
    join(directory, 'node_modules', 'typescript'),
    'junction'
  )
  writeFileSync(join(directory, 'package.json'), '{"name":"synthetic","version":"1.0.0","type":"module"}')
  writeFileSync(join(directory, 'tsconfig.json'), '{"compilerOptions":{"strict":true,"types":[]}}')
  writeFileSync(join(directory, 'types.ts'), 'export interface Shape { answer: number }')
  writeFileSync(
    join(directory, 'index.ts'),
    "import type { Shape } from './types'; export const value: Shape = { answer: 42 };"
  )
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const consumer = createRequire(process.argv[1])
const rollup = consumer('rollup')
const original = rollup.rollup
let calls = 0
rollup.rollup = (...args) => { calls++; return original(...args) }
consumer('tsup').build({ entry: ['index.ts'], format: ['esm', 'cjs'], dts: true, treeshake: true,
  config: false, tsconfig: 'tsconfig.json', silent: true, outDir: 'dist' }).then(() => {
  assert.ok(calls >= 2, 'Rollup treeshaking must execute / 必须执行 Rollup 摇树')
}).catch((error) => { console.error(error); process.exitCode = 1 })
`,
      consumer.resolve('tsup')
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 65536,
      env: { ...process.env, NODE_ENV: 'production' }
    }
  )
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.signal, null)
  for (const extension of ['js', 'cjs']) {
    const code = readFileSync(join(directory, 'dist', `index.${extension}`), 'utf8')
    assert.match(code, /answer: 42/)
  }
  for (const extension of ['d.ts', 'd.cts']) {
    const declaration = readFileSync(join(directory, 'dist', `index.${extension}`), 'utf8')
    assert.match(declaration, /interface Shape/)
    assert.match(declaration, /answer: number/)
    assert.doesNotMatch(declaration, /from ['"]\.\/types/)
    assert.match(declaration, /export \{ value \}/)
  }
})
