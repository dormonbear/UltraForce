import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import test, { after } from 'node:test'

// Use the actual parent dependency, including its loaded native libraries. / 使用实际父包依赖及其已加载原生库。
const require = createRequire(import.meta.url)
const plasmoEntry = require.resolve('plasmo')
const plasmo = createRequire(plasmoEntry)
const sharp = plasmo('sharp')
const native = Object.values(require.cache).find(
  (loaded) => basename(loaded.filename || '').startsWith('sharp-') && loaded.filename.endsWith('.node')
)
const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-sharp-')))
after(() => rmSync(root, { recursive: true, force: true }))

function atLeast(actual, floor) {
  const left = actual.split('.').map(Number)
  const right = floor.split('.').map(Number)
  for (let index = 0; index < right.length; index++) {
    if ((left[index] || 0) !== right[index]) return (left[index] || 0) > right[index]
  }
  return true
}

// These guards verify effective patched native bits; they are not CVE exploit reproductions. / 下限检查验证实际修复原生库，不代表 CVE 利用复现。
for (const [library, floor] of [
  ['vips', '8.18.3'],
  ['heif', '1.23.2'],
  ['rsvg', '2.63.2']
]) {
  test(`actual loaded ${library} meets upstream security floor ${floor} / 实际加载原生库达到上游安全下限`, () => {
    assert.equal(typeof sharp.versions[library], 'string')
    assert.ok(atLeast(sharp.versions[library], floor), `${library} ${sharp.versions[library]} < ${floor}`)
  })
}

test('resize and contain preserve dimensions and alpha / 缩放及容纳保持尺寸及透明度', async () => {
  const input = await sharp({
    create: { width: 8, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
  })
    .png()
    .toBuffer()
  const { data, info } = await sharp(input)
    .resize({ width: 16, height: 16, fit: 'contain', background: '#00000000' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height, info.channels], [16, 16, 4])
  assert.equal(data[3], 0)
  const center = (8 * 16 + 8) * 4
  assert.equal(data[center], 255)
  assert.ok(Math.abs(data[center + 3] - 128) <= 1)
})

test('PNG buffer and file round trips preserve synthetic pixels / PNG 缓冲及文件往返保持合成像素', async () => {
  const input = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 255])
  const file = join(root, 'round-trip.png')
  await sharp(input, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toFile(file)
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height, info.channels], [2, 2, 4])
  assert.deepEqual(data, input)
})

test('development grayscale and SVG decoding preserve ordinary image behavior / 开发灰度及 SVG 解码保持普通图像行为', async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#123456"/></svg>'
  )
  const output = await sharp(svg).resize({ width: 16, height: 16 }).greyscale().png().toBuffer()
  const { data, info } = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height], [16, 16])
  for (let index = 0; index < data.length; index += info.channels) {
    for (let channel = 1; channel < info.channels; channel++) assert.equal(data[index], data[index + channel])
  }
})

test('actual Plasmo generates all synthetic PNG icons through its Sharp edge / 实际 Plasmo 经其 Sharp 路径生成全部合成 PNG 图标', async () => {
  const fixture = join(root, 'plasmo')
  mkdirSync(join(fixture, 'assets'), { recursive: true })
  mkdirSync(join(fixture, 'src'))
  symlinkSync(resolve('node_modules'), join(fixture, 'node_modules'), 'junction')
  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify({
      name: 'synthetic-sharp',
      version: '1.0.0',
      dependencies: { plasmo: '0.90.5', react: '19.3.1', 'react-dom': '19.3.1' }
    })
  )
  writeFileSync(join(fixture, 'src', 'background.ts'), 'globalThis.syntheticValue = 42')
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({ extends: 'plasmo/templates/tsconfig.base', compilerOptions: { types: [] } })
  )
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 18, g: 52, b: 86, alpha: 0.5 } } })
    .png()
    .toFile(join(fixture, 'assets', 'icon.png'))
  const loadedFile = join(fixture, 'sharp-loaded.json')
  const hook = join(fixture, 'hook.cjs')
  // Observe native loading for CJS and ESM Sharp without preloading or wrapping its API. / 观察 CJS 及 ESM Sharp 原生加载，不预加载或包装 API。
  writeFileSync(
    hook,
    `process.on('exit',()=>{const{writeFileSync}=require('node:fs');const{basename}=require('node:path');const loaded=Object.values(require.cache).find(m=>basename(m.filename||'').startsWith('sharp-')&&m.filename.endsWith('.node'));if(loaded){const version=loaded.exports.libvipsVersion();writeFileSync(${JSON.stringify(loadedFile)},JSON.stringify({path:loaded.filename,vips:typeof version==='string'?version:version.semver,isGlobal:version.isGlobal}))}});`
  )
  const cli = join(dirname(dirname(plasmoEntry)), 'bin', 'index.mjs')
  const env = { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: `--require=${hook}` }
  delete env.PLASMO_PUBLIC_E2E
  const result = spawnSync(process.execPath, [cli, 'build'], {
    cwd: fixture,
    env,
    encoding: 'utf8',
    timeout: 90000,
    maxBuffer: 1024 * 1024
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, (result.stdout + result.stderr).slice(-6000))
  assert.equal(result.signal, null)
  assert.doesNotMatch(result.stdout + result.stderr, /No icon found/)
  const loaded = JSON.parse(readFileSync(loadedFile, 'utf8'))
  assert.equal(loaded.path, native.filename)
  assert.equal(loaded.vips, sharp.versions.vips)
  if (loaded.isGlobal !== undefined) assert.equal(loaded.isGlobal, false)
  console.log(JSON.stringify({ cliNative: loaded, linkedVersions: sharp.versions }))
  const outputDirectory = join(fixture, 'build', 'chrome-mv3-prod')
  const manifest = JSON.parse(readFileSync(join(outputDirectory, 'manifest.json'), 'utf8'))
  for (const size of [128, 64, 48, 32, 16]) {
    assert.equal(typeof manifest.icons[size], 'string')
    const { data, info } = await sharp(join(outputDirectory, manifest.icons[size]))
      .raw()
      .toBuffer({ resolveWithObject: true })
    assert.deepEqual([info.width, info.height, info.channels], [size, size, 4])
    // Alpha resampling rounds colour channels by one unit. / 透明度重采样会对颜色通道产生一单位舍入。
    for (let index = 0; index < data.length; index += 4) {
      for (const [channel, expected] of [18, 52, 86, 128].entries())
        assert.ok(Math.abs(data[index + channel] - expected) <= 1)
    }
  }
})
