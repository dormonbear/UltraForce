import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// Resolve the installed build edge, never a hoisted substitute. / 解析已安装构建边，不使用提升后的替代包。
let edge = createRequire(import.meta.url)
for (const name of ['plasmo', '@plasmohq/parcel-config', '@parcel/transformer-svg-react']) {
  edge = createRequire(edge.resolve(name))
}
const jsxRequire = createRequire(edge.resolve('@svgr/plugin-jsx'))
const coreRequire = createRequire(edge.resolve('@svgr/core'))
const presetRequire = createRequire(jsxRequire.resolve('@svgr/babel-preset'))
const babel = jsxRequire('@babel/core')
const svgr = edge('@svgr/core')
const parcel = edge('@parcel/transformer-svg-react').default[Symbol.for('parcel-plugin-config')]
const marker = 'owned-babel-source-map-fixture / 自有 Babel 源码映射夹具'
const source = 'const fixture = 1;'
const map = {
  version: 3,
  file: 'input.js',
  sources: ['owned.js'],
  sourcesContent: [marker],
  names: [],
  mappings: 'AAAA'
}

function fixture(run) {
  const root = fs.mkdtempSync(join(tmpdir(), 'ultraforce-babel-'))
  const packageRoot = join(root, 'package')
  const input = join(packageRoot, 'src')
  fs.mkdirSync(input, { recursive: true })
  fs.writeFileSync(join(packageRoot, 'package.json'), '{}')
  const outside = join(root, 'outside.map')
  fs.writeFileSync(outside, JSON.stringify(map))
  try {
    return run({ root, packageRoot, input, outside, filename: join(input, 'input.js') })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function transform(annotation, { packageRoot, filename }, options = {}) {
  return babel.transformSync(`${source}\n//# sourceMappingURL=${annotation}`, {
    root: packageRoot,
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    ...options
  })
}

function assertExcluded(annotation, paths, options = {}) {
  const original = fs.readFileSync
  let reads = 0
  // Observe only our own sentinel; always restore before cleanup. / 仅观测自有哨兵，并在清理前恢复。
  fs.readFileSync = function (file, ...args) {
    if (file === paths.outside) reads++
    return original.call(this, file, ...args)
  }
  try {
    const result = transform(annotation, paths, options)
    assert.equal(reads, 0, 'Outside sentinel is not read / 不读取边界外哨兵')
    assert.equal(JSON.stringify(result.map).includes(marker), false)
    assert.match(result.code, /const fixture = 1/)
  } finally {
    fs.readFileSync = original
  }
}

test('SVGR core, JSX plugin and preset share Babel / SVGR 核心、JSX 插件及预设共用 Babel', () => {
  for (const consumer of [coreRequire, presetRequire]) {
    assert.equal(consumer.resolve('@babel/core'), jsxRequire.resolve('@babel/core'))
  }
})

test('automatic maps cannot traverse outside the input package / 自动映射不能遍历到输入包之外', () => {
  fixture((paths) => assertExcluded('../../outside.map', paths))
})

test('automatic absolute maps outside the input package are ignored / 忽略输入包之外的自动绝对路径映射', () => {
  fixture((paths) => assertExcluded(paths.outside, paths))
})

test('configured root bounds maps when no package manifest exists / 无包清单时配置根目录限定映射', () => {
  fixture((paths) => {
    fs.rmSync(join(paths.packageRoot, 'package.json'))
    assertExcluded('../../outside.map', paths)
  })
})

test('inputSourceMap false skips external maps / inputSourceMap false 跳过外部映射', () => {
  fixture((paths) => assertExcluded(paths.outside, paths, { inputSourceMap: false }))
})

test('ordinary sibling and parent maps inside the package remain supported / 保留包内普通同目录及父目录映射', () => {
  fixture((paths) => {
    for (const [file, annotation] of [
      [join(paths.input, 'input.js.map'), 'input.js.map'],
      [join(paths.packageRoot, 'parent.map'), '../parent.map']
    ]) {
      fs.writeFileSync(file, JSON.stringify(map))
      assert.ok(JSON.stringify(transform(annotation, paths).map).includes(marker))
    }
  })
})

test('inline source maps remain supported / 保留内联源码映射', () => {
  fixture((paths) => {
    const inline = `data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
    assert.ok(JSON.stringify(transform(inline, paths).map).includes(marker))
  })
})

test('explicit trusted maps override external references / 显式可信映射覆盖外部引用', () => {
  fixture((paths) => {
    const result = transform(paths.outside, paths, { inputSourceMap: map })
    assert.ok(JSON.stringify(result.map).includes(marker))
  })
})

test('malformed and missing maps preserve ordinary transforms / 损坏及缺失映射保留普通转换', () => {
  fixture((paths) => {
    fs.writeFileSync(join(paths.input, 'invalid.map'), '{')
    for (const annotation of ['invalid.map', 'missing.map']) {
      const result = transform(annotation, paths)
      assert.match(result.code, /const fixture = 1/)
      assert.equal(JSON.stringify(result.map).includes(marker), false)
    }
  })
})

test('ordinary Babel JSX parsing remains compatible / 普通 Babel JSX 解析保持兼容', () => {
  const result = babel.transformSync('const fixture = <svg><path d="M0 0" /></svg>', {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx'] }
  })
  assert.match(result.code, /<svg><path d="M0 0"\s*\/><\/svg>/)
})

test('SVGR preserves JSX and TypeScript component generation / SVGR 保留 JSX 及 TypeScript 组件生成', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>'
  for (const typescript of [false, true]) {
    let inputSourceMap
    const code = svgr.transform.sync(
      svg,
      {
        runtimeConfig: false,
        typescript,
        jsx: {
          babelConfig: {
            plugins: [
              () => ({
                pre(file) {
                  inputSourceMap = file.opts.inputSourceMap
                }
              })
            ]
          }
        }
      },
      { componentName: 'OwnedIcon' }
    )
    assert.equal(inputSourceMap, false, 'Ordinary SVGR disables automatic maps / 普通 SVGR 禁用自动映射')
    assert.match(code, /const OwnedIcon/)
    assert.match(code, /<svg/)
    assert.match(code, /export default OwnedIcon/)
    if (typescript) assert.match(code, /SVGProps<SVGSVGElement>/)
  }
})

test('Parcel SVG transformer retains its ordinary parent path / Parcel SVG 转换器保留普通父调用路径', async () => {
  let output
  const asset = {
    filePath: join(tmpdir(), 'owned-icon.svg'),
    type: 'svg',
    bundleBehavior: 'isolated',
    async getCode() {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M0 0h10v10H0z"/></svg>'
    },
    setCode(code) {
      output = code
    }
  }
  assert.deepEqual(await parcel.transform({ asset, config: {} }), [asset])
  assert.equal(asset.type, 'jsx')
  assert.equal(asset.bundleBehavior, null)
  assert.match(output, /<svg/)
  assert.match(output, /export default SvgOwnedIcon/)
})
