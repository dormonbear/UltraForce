import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const plasmoRequire = createRequire(require.resolve('plasmo'))
const configRequire = createRequire(plasmoRequire.resolve('@plasmohq/parcel-config/package.json'))
const transformerPath = configRequire.resolve('@plasmohq/parcel-transformer-manifest')
const transformerRequire = createRequire(transformerPath)
const parserModule = transformerRequire('content-security-policy-parser')
const parse = parserModule.default || parserModule
const transform = configRequire('@plasmohq/parcel-transformer-manifest').default[Symbol.for('parcel-plugin-config')]
  .transform

// Use Parcel's public transformer contract with an isolated in-memory asset. / 使用 Parcel 公开转换器契约及隔离的内存资源。
async function manifest(policy, { version = 3, hot = true } = {}) {
  const previous = process.env.PLASMO_SRC_DIR
  process.env.PLASMO_SRC_DIR = '/synthetic/src'
  let output
  const asset = {
    filePath: '/synthetic/.plasmo/manifest.json',
    env: { outputFormat: 'global', engines: { browsers: ['chrome 100'] } },
    meta: {},
    fs: { exists: async () => false, existsSync: () => false },
    setEnvironment() {},
    getCode: async () =>
      JSON.stringify({
        manifest_version: version,
        name: 'Synthetic / 合成',
        version: '1.0.0',
        content_security_policy: policy
      }),
    setCode(code) {
      output = JSON.parse(code)
    },
    addURLDependency(url) {
      return url
    }
  }
  try {
    await transform({
      asset,
      options: { env: { PLASMO_BROWSER: 'chrome' }, hmrOptions: hot ? { port: 1234 } : undefined }
    })
    return output.content_security_policy
  } finally {
    if (previous === undefined) delete process.env.PLASMO_SRC_DIR
    else process.env.PLASMO_SRC_DIR = previous
  }
}

const policy = "default-src 'self'; script-src 'self'; object-src 'none'; connect-src https://synthetic.invalid"
function directives(value) {
  return new Map(
    value
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([key]) => key)
      .map(([key, ...values]) => [key, values])
  )
}

test('directive names never change the parsed prototype / 指令名称不会改变解析结果的原型', () => {
  const ordinary = parse("default-src 'self'")
  const special = parse("default-src 'self'; __proto__ injected; constructor data; toString data")
  assert.equal(Object.getPrototypeOf(special), Object.getPrototypeOf(ordinary))
  assert.equal(Object.prototype.injected, undefined)
})

test('MV3 development preserves extension and sandbox directives / MV3 开发构建保留扩展及沙盒指令', async () => {
  const result = await manifest({ extension_pages: policy, sandbox: policy + '; sandbox allow-forms' })
  for (const key of ['extension_pages', 'sandbox']) {
    const parsed = directives(result[key])
    assert.deepEqual(parsed.get('default-src'), ["'self'"])
    assert.deepEqual(parsed.get('object-src'), ["'none'"])
    assert.deepEqual(parsed.get('connect-src'), ['https://synthetic.invalid'])
  }
  assert.deepEqual(directives(result.extension_pages).get('script-src'), ["'self'", 'http://localhost'])
  assert.deepEqual(directives(result.sandbox).get('sandbox'), ['allow-forms', 'allow-scripts'])
})

test('production leaves the explicit policy unchanged / 生产构建保持显式策略不变', async () => {
  const input = { extension_pages: policy, sandbox: policy + '; sandbox allow-forms' }
  assert.deepEqual(await manifest(input, { hot: false }), input)
})

test('MV2 development preserves policy directives / MV2 开发构建保留策略指令', async () => {
  const parsed = directives(await manifest(policy, { version: 2 }))
  assert.deepEqual(parsed.get('object-src'), ["'none'"])
  assert.deepEqual(parsed.get('connect-src'), ['https://synthetic.invalid'])
  assert.deepEqual(parsed.get('script-src'), ["'self'", "'unsafe-eval'"])
})

test('special directive names remain data through transformation / 特殊指令名称在转换中保持为数据', async () => {
  const result = await manifest({ extension_pages: policy + '; __proto__ injected; constructor data' })
  assert.deepEqual(directives(result.extension_pages).get('object-src'), ["'none'"])
  assert.deepEqual(directives(result.extension_pages).get('__proto__'), ['injected'])
  assert.equal(Object.prototype.injected, undefined)
})
