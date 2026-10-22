import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// Resolve the configuration loader through the actual Plasmo HTML optimizer. / 通过实际 Plasmo HTML 优化器解析配置加载器。
let dependencyRequire = createRequire(import.meta.url)
for (const name of [
  'plasmo',
  '@plasmohq/parcel-config',
  '@parcel/config-default',
  '@parcel/optimizer-htmlnano',
  'htmlnano'
]) {
  dependencyRequire = createRequire(dependencyRequire.resolve(name))
}
const { cosmiconfig, cosmiconfigSync } = dependencyRequire('cosmiconfig')

async function withConfig(source, run) {
  const directory = await mkdtemp(join(tmpdir(), 'ultraforce-yaml-config-'))
  const filepath = join(directory, '.htmlnanorc.yaml')
  try {
    await writeFile(filepath, source)
    await run(filepath)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

for (const [mode, createExplorer] of [
  ['async / 异步', cosmiconfig],
  ['sync / 同步', cosmiconfigSync]
]) {
  test(`YAML merge preserves the result prototype (${mode}) / YAML 合并保留结果原型`, async () => {
    const source = 'base: &base {__proto__: {syntheticMarker: true}}\nresult:\n  <<: *base\n'
    await withConfig(source, async (filepath) => {
      const { config } = await createExplorer('htmlnano').load(filepath)
      assert.equal(Object.getPrototypeOf(config.result), Object.prototype)
      assert.equal(Object.prototype.hasOwnProperty.call(config.result, '__proto__'), true)
      assert.deepEqual(config.result.__proto__, { syntheticMarker: true })
      assert.equal(config.result.syntheticMarker, undefined)
      assert.equal(Object.prototype.syntheticMarker, undefined)
    })
  })

  test(`YAML empty merges consume the default work budget (${mode}) / YAML 空合并计入默认工作预算`, async () => {
    // A bounded fixture crosses the default 10,000-merge budget without large allocations or timing assertions. / 有界夹具超过默认一万次合并预算，不依赖大规模分配或计时断言。
    const source = `sources: &sources [${Array(101).fill('{}').join(',')}]\ntargets:\n${'  - <<: *sources\n'.repeat(100)}`
    await withConfig(source, async (filepath) => {
      await assert.rejects(async () => createExplorer('htmlnano').load(filepath), /abnormal merge sequence size/)
    })
  })

  test(`YAML normal merge precedence and values survive (${mode}) / YAML 正常合并优先级及值保持一致`, async () => {
    const source =
      'first: &first {removeComments: true, collapseWhitespace: false}\nsecond: &second {removeComments: false, minifyCss: true}\nresult:\n  <<: [*first, *second]\n  collapseWhitespace: true\n  custom: {enabled: false, count: 0, value: null, items: [one, two]}\n'
    await withConfig(source, async (filepath) => {
      const result = await createExplorer('htmlnano').load(filepath)
      assert.equal(result.filepath, filepath)
      assert.deepEqual(result.config.result, {
        removeComments: true,
        collapseWhitespace: true,
        minifyCss: true,
        custom: { enabled: false, count: 0, value: null, items: ['one', 'two'] }
      })
    })
  })

  test(`YAML merge chains consume the default key budget (${mode}) / YAML 合并链计入默认键预算`, async () => {
    const mappings = ['m0: &m0 {key0: 0}']
    for (let index = 1; index < 150; index++) {
      mappings.push(`m${index}: &m${index} {<<: *m${index - 1}, key${index}: ${index}}`)
    }
    await withConfig(`${mappings.join('\n')}\n`, async (filepath) => {
      await assert.rejects(
        async () => createExplorer('htmlnano').load(filepath),
        /merge keys exceeded maxTotalMergeKeys/
      )
    })
  })

  test(`YAML ordered maps preserve special keys and reject duplicates (${mode}) / YAML 有序映射保留特殊键并拒绝重复`, async () => {
    await withConfig('ordered: !!omap [{__proto__: first}, {normal: second}]\n', async (filepath) => {
      const { config } = await createExplorer('htmlnano').load(filepath)
      assert.deepEqual(Object.keys(config.ordered[0]), ['__proto__'])
      assert.equal(config.ordered[0].__proto__, 'first')
      assert.deepEqual(config.ordered[1], { normal: 'second' })
    })
    await withConfig('ordered: !!omap [{__proto__: first}, {__proto__: second}]\n', async (filepath) => {
      await assert.rejects(async () => createExplorer('htmlnano').load(filepath), /cannot resolve a node/)
    })
  })
}
