import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

export function resolverSnapshots(lock) {
  const parent = '@plasmohq/parcel-resolver-post@0.4.5'
  return Object.entries(lock.snapshots).filter(([key]) => key === parent || key.startsWith(`${parent}(`))
}

export function resolverHasTsup(lock) {
  return resolverSnapshots(lock).some(([, snapshot]) =>
    ['dependencies', 'optionalDependencies'].some((section) => Object.hasOwn(snapshot[section] ?? {}, 'tsup'))
  )
}

// Resolve only the direct pnpm link, never an unrelated hoisted package. / 仅解析 pnpm 直接链接，不解析无关的提升包。
export function resolveResolverTsup(lock, resolverEntry) {
  if (!resolverHasTsup(lock)) return undefined
  const resolverRoot = dirname(dirname(resolverEntry))
  const directTsup = resolve(resolverRoot, '../../tsup')
  return createRequire(resolverEntry).resolve(directTsup)
}

// Follow installed build-tool edges, rather than a separately installed test dependency. / 沿已安装构建工具依赖路径解析，而非另装测试依赖。
const require = createRequire(import.meta.url)
const plasmoRequire = createRequire(require.resolve('plasmo'))
export const fflate = plasmoRequire('fflate')
let parentRequire = plasmoRequire
parentRequire = createRequire(parentRequire.resolve('@plasmohq/parcel-config'))
const resolverEntry = parentRequire.resolve('@plasmohq/parcel-resolver-post')
parentRequire = createRequire(resolverEntry)
const lock = parse(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
const tsupPath = resolveResolverTsup(lock, resolverEntry)
export let glob, globCli, minimatch, expand
if (tsupPath) {
  parentRequire = createRequire(tsupPath)
  parentRequire = createRequire(parentRequire.resolve('sucrase'))
  glob = parentRequire('glob')
  const globRequire = createRequire(parentRequire.resolve('glob'))
  globCli = globRequire.resolve('../esm/bin.mjs')
  const minimatchRequire = createRequire(globRequire.resolve('minimatch'))
  minimatch = globRequire('minimatch').minimatch
  const brace = minimatchRequire('brace-expansion')
  expand = typeof brace === 'function' ? brace : brace.expand
}

// A real ZIP64 footer activates the extra-field path; changing only a size sentinel does not. / 真实 ZIP64 页脚会进入附加字段路径，仅改大小哨兵不会进入该路径。
export function zip64Fixture(includeExtra) {
  const original = Buffer.from(fflate.zipSync({ 'a.txt': fflate.strToU8('ok') }, { level: 0 }))
  const endOffset = original.length - 22
  const centralOffset = original.readUInt32LE(endOffset + 16)
  const central = Buffer.from(original.subarray(centralOffset, endOffset))
  const compressed = central.readUInt32LE(20)
  const uncompressed = central.readUInt32LE(24)
  const localOffset = central.readUInt32LE(42)
  central.writeUInt32LE(0xffffffff, 20)
  central.writeUInt32LE(0xffffffff, 24)
  central.writeUInt32LE(0xffffffff, 42)
  const extra = Buffer.alloc(includeExtra ? 28 : 0)
  if (includeExtra) {
    extra.writeUInt16LE(1, 0)
    extra.writeUInt16LE(24, 2)
    extra.writeBigUInt64LE(BigInt(uncompressed), 4)
    extra.writeBigUInt64LE(BigInt(compressed), 12)
    extra.writeBigUInt64LE(BigInt(localOffset), 20)
  }
  central.writeUInt16LE(extra.length, 30)
  const centralLength = central.length + extra.length
  const zip64Offset = centralOffset + centralLength
  const zip64End = Buffer.alloc(56)
  zip64End.writeUInt32LE(0x06064b50, 0)
  zip64End.writeBigUInt64LE(44n, 4)
  zip64End.writeUInt16LE(45, 12)
  zip64End.writeUInt16LE(45, 14)
  zip64End.writeBigUInt64LE(1n, 24)
  zip64End.writeBigUInt64LE(1n, 32)
  zip64End.writeBigUInt64LE(BigInt(centralLength), 40)
  zip64End.writeBigUInt64LE(BigInt(centralOffset), 48)
  const locator = Buffer.alloc(20)
  locator.writeUInt32LE(0x07064b50, 0)
  locator.writeBigUInt64LE(BigInt(zip64Offset), 8)
  locator.writeUInt32LE(1, 16)
  const end = Buffer.from(original.subarray(endOffset))
  end.writeUInt16LE(0xffff, 8)
  end.writeUInt16LE(0xffff, 10)
  end.writeUInt32LE(0xffffffff, 12)
  end.writeUInt32LE(0xffffffff, 16)
  return Buffer.concat([original.subarray(0, centralOffset), central, extra, zip64End, locator, end])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  switch (process.argv[2]) {
    case 'zip64':
      assert.throws(
        () => fflate.unzipSync(zip64Fixture(false)),
        (error) => error.code === 13
      )
      break
    case 'extglob':
      assert.equal(minimatch(`${'a'.repeat(30)}z`, '*(*(*(a|b)))'), false)
      assert.equal(minimatch('abab', '*(*(*(a|b)))'), true)
      break
    case 'zero-step':
      assert.deepEqual(expand('{0..2..0}'), ['0', '1', '2'])
      assert.deepEqual(expand('{c..a..0}'), ['c', 'b', 'a'])
      break
    default:
      throw new Error('UNKNOWN_BUILD_INPUT_FIXTURE')
  }
  process.stdout.write('ok\n')
}
