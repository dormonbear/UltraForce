import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// Follow the actual build dependency edge, including the parent's pinned codec. / 沿实际构建依赖路径解析，包括父包锁定的编码器。
const require = createRequire(import.meta.url)
const plasmoRequire = createRequire(require.resolve('plasmo'))
const coreRequire = createRequire(plasmoRequire.resolve('@parcel/core'))
const cacheRequire = createRequire(coreRequire.resolve('@parcel/cache'))
const lmdbRequire = createRequire(cacheRequire.resolve('lmdb'))
const { unpack } = lmdbRequire('msgpackr')
const { open } = cacheRequire('lmdb')
const { LMDBCache } = coreRequire('@parcel/cache')

test('rejects invalid record keys before coercion / 在类型转换前拒绝无效记录键', () => {
  // Record definition with an array property: exercise the upstream object-coercion fix without a hanging payload. / 数组属性记录定义：验证上游对象转换修复，不使用会卡住的载荷。
  const invalidRecord = Buffer.from([0xd4, 0x72, 0x40, 0x91, 0x90, 0x01])
  assert.throws(() => unpack(invalidRecord), /Invalid property type for record/)
})

test('decodes structured values written by the previous codec / 解码旧编码器写入的结构化值', () => {
  // Synthetic cyclic object encoded by msgpackr 1.8.5 with structuredClone enabled. / 使用启用 structuredClone 的 msgpackr 1.8.5 编码的合成循环对象。
  const legacy = '1mkAAAAB1HJAlKRuYW1lpWNvdW50pWJ5dGVzpHNlbGaybGVnYWN5IC8g5pen54mI5pysAMQCAP/WcAAAAAE='
  const value = unpack(Buffer.from(legacy, 'base64'))
  assert.equal(value.name, 'legacy / 旧版本')
  assert.equal(value.count, 0)
  assert.deepEqual(value.bytes, Buffer.from([0, 255]))
  assert.equal(value.self, value)
})

test('LMDB codec preserves structured values across reopen / LMDB 编码器重新打开后保留结构化值', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ultraforce-codec-'))
  let store
  try {
    const value = { name: 'synthetic / 合成', count: 0, bytes: Buffer.from([0, 255]), self: null }
    value.self = value
    store = open(dir, { encoding: 'msgpack', structuredClone: true, compression: true })
    await store.put('fixture', value)
    await store.close()
    store = null
    store = open(dir, { encoding: 'msgpack', structuredClone: true, compression: true })
    const restored = store.get('fixture')
    assert.equal(restored.self, restored)
    assert.equal(restored.name, value.name)
    assert.equal(restored.count, 0)
    assert.deepEqual(restored.bytes, value.bytes)
  } finally {
    if (store) await store.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('Parcel binary cache preserves serialized values and blobs across reopen / Parcel 二进制缓存重新打开后保留序列化值和数据块', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ultraforce-parcel-cache-'))
  let cache
  try {
    const value = { name: 'synthetic / 合成', rows: [{ id: '001', count: 0 }], enabled: false }
    const blob = Buffer.alloc(32768, 0x61)
    cache = new LMDBCache(dir)
    await cache.ensure()
    await cache.set('fixture', value)
    await cache.setBlob('blob', blob)
    assert.deepEqual(await cache.get('fixture'), value)
    await cache.store.close()
    cache = null
    cache = new LMDBCache(dir)
    assert.deepEqual(await cache.get('fixture'), value)
    assert.deepEqual(await cache.getBlob('blob'), blob)
    assert.equal(await cache.has('missing'), false)
    assert.equal(await cache.get('missing'), null)
  } finally {
    if (cache) await cache.store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
