import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'
import { resolverHasTsup, resolverSnapshots, resolveResolverTsup } from './build-inputs-fixture.mjs'

let consumer = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config']) {
  consumer = createRequire(consumer.resolve(name))
}
const resolverPath = consumer.resolve('@plasmohq/parcel-resolver-post')
const resolverRequire = createRequire(resolverPath)
const coreRequire = createRequire(resolverRequire.resolve('@parcel/core'))

function assertResolverEdgeRemoved(lock) {
  assert.ok(resolverSnapshots(lock).length > 0, 'Resolver snapshot must exist / 解析器快照必须存在')
  assert.equal(resolverHasTsup(lock), false, 'Resolver must not depend on tsup / 解析器不得依赖 tsup')
}

test('only the unused exact-parent tsup edge is removed / 仅移除未使用的精确父级 tsup 依赖边', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const lock = parse(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
  const override = '@plasmohq/parcel-resolver-post@0.4.5>tsup'
  assert.equal(resolverRequire('@plasmohq/parcel-resolver-post/package.json').version, '0.4.5')
  assert.equal(manifest.pnpm.overrides[override], '-')
  assert.equal(lock.overrides[override], '-')
  assertResolverEdgeRemoved(lock)
})

test('unrelated lock packages are allowed but an exact edge is detected / 允许无关锁文件包但能检测精确依赖边', () => {
  const target = '@plasmohq/parcel-resolver-post@0.4.5(peer@1.0.0)'
  const lock = {
    packages: { 'glob@10.5.0': {}, 'minimatch@9.0.7': {}, 'brace-expansion@5.0.12': {}, 'rollup@3.30.0': {} },
    snapshots: {
      [target]: { dependencies: { '@parcel/core': '2.9.3' } },
      '@plasmohq/parcel-resolver-post@0.4.50': { dependencies: { tsup: '9.9.9' } },
      'unrelated@1.0.0': { dependencies: { tsup: '9.9.9', glob: '10.5.0', rollup: '3.30.0' } },
      'tsup@9.9.9': {},
      'glob@10.5.0': {},
      'minimatch@9.0.7': {},
      'brace-expansion@5.0.12': {},
      'rollup@3.30.0': {}
    }
  }
  assert.doesNotThrow(() => assertResolverEdgeRemoved(lock))
  assert.equal(resolverHasTsup(lock), false)
  lock.snapshots['@plasmohq/parcel-resolver-post@0.4.5(peer@2.0.0)'] = {
    optionalDependencies: { tsup: '7.2.0' }
  }
  assert.equal(resolverHasTsup(lock), true)
  assert.throws(() => assertResolverEdgeRemoved(lock), /Resolver must not depend on tsup/)
})

test('unrelated hoisted tsup cannot replace the resolver direct link / 无关提升版 tsup 不能替代解析器直接链接', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'ultraforce-resolver-selection-')))
  try {
    const virtualModules = join(directory, 'node_modules', '.pnpm', 'resolver-fixture', 'node_modules')
    const entry = join(virtualModules, '@plasmohq', 'parcel-resolver-post', 'dist', 'index.js')
    const hoisted = join(directory, 'node_modules', 'tsup', 'index.js')
    const direct = join(virtualModules, 'tsup', 'index.js')
    await mkdir(join(virtualModules, '@plasmohq', 'parcel-resolver-post', 'dist'), { recursive: true })
    await mkdir(join(directory, 'node_modules', 'tsup'), { recursive: true })
    await writeFile(entry, '')
    await writeFile(hoisted, 'module.exports = "unrelated"')
    const lock = { snapshots: { '@plasmohq/parcel-resolver-post@0.4.5': { dependencies: {} } } }
    assert.equal(createRequire(entry).resolve('tsup'), hoisted)
    assert.equal(resolveResolverTsup(lock, entry), undefined)
    lock.snapshots['@plasmohq/parcel-resolver-post@0.4.5'].dependencies.tsup = '7.2.0'
    assert.throws(() => resolveResolverTsup(lock, entry), { code: 'MODULE_NOT_FOUND' })
    await mkdir(join(virtualModules, 'tsup'), { recursive: true })
    await writeFile(direct, 'module.exports = "direct"')
    assert.equal(resolveResolverTsup(lock, entry), direct)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('real resolver handles synthetic imports with tsup loading forbidden / 禁止加载 tsup 时真实解析器处理合成导入', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'ultraforce-resolver-unused-')))
  const previousProjectDir = process.env.PLASMO_PROJECT_DIR
  const denied = (value) => /(?:^|[/\\])tsup(?:@[^/\\]+)?(?:[/\\]|$)/.test(value)
  let blocked = 0
  const guard = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (denied(specifier)) {
        blocked++
        throw new Error('TSUP_LOAD_FORBIDDEN')
      }
      const result = nextResolve(specifier, context)
      if (denied(result.url)) {
        blocked++
        throw new Error('TSUP_LOAD_FORBIDDEN')
      }
      return result
    }
  })
  try {
    assert.throws(() => resolverRequire('tsup'), /TSUP_LOAD_FORBIDDEN/)
    assert.equal(blocked, 1)
    blocked = 0
    const { NodeFS } = coreRequire('@parcel/fs')
    process.env.PLASMO_PROJECT_DIR = directory
    await mkdir(join(directory, 'src'), { recursive: true })
    await mkdir(join(directory, 'nested'), { recursive: true })
    await mkdir(join(directory, 'node_modules', 'owned-fixture'), { recursive: true })
    await writeFile(join(directory, 'entry.ts'), '')
    await writeFile(join(directory, 'entry.js'), '')
    await writeFile(join(directory, 'local.ts'), 'export const value = 1')
    await writeFile(join(directory, 'nested', 'index.ts'), 'export const value = 2')
    await writeFile(join(directory, 'src', 'aliased.ts'), 'export const value = 3')
    await writeFile(join(directory, 'node_modules', 'owned-fixture', 'index.js'), 'module.exports = 4')
    await writeFile(
      join(directory, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@owned/*': ['src/*'] } } })
    )
    const resolver = consumer('@plasmohq/parcel-resolver-post').default[Symbol.for('parcel-plugin-config')]
    const resolve = (specifier, file = 'entry.ts') =>
      resolver.resolve({
        specifier,
        dependency: { specifier, resolveFrom: join(directory, file) },
        options: { inputFS: new NodeFS() }
      })
    assert.deepEqual(await resolve('./local'), { filePath: join(directory, 'local.ts') })
    assert.deepEqual(await resolve('./nested'), { filePath: join(directory, 'nested', 'index.ts') })
    assert.deepEqual(await resolve('@owned/aliased'), { filePath: join(directory, 'src', 'aliased.ts') })
    assert.deepEqual(await resolve('owned-fixture', 'entry.js'), {
      filePath: join(directory, 'node_modules', 'owned-fixture', 'index.js')
    })
    assert.equal(await resolve('missing-owned-fixture', 'entry.js'), null)
    assert.equal(blocked, 0, 'Resolver never loads tsup / 解析器从未加载 tsup')
  } finally {
    guard.deregister()
    if (previousProjectDir === undefined) delete process.env.PLASMO_PROJECT_DIR
    else process.env.PLASMO_PROJECT_DIR = previousProjectDir
    await rm(directory, { recursive: true, force: true })
  }
})
