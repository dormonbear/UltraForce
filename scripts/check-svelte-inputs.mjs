import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const generatedRoots = new Set([
  '.git',
  '.planning',
  '.plasmo',
  '.codegraph',
  'build',
  'coverage',
  'dist',
  'playwright-report',
  'test-results'
])

function findSvelteInput(root) {
  const realRoot = realpathSync(root)
  const visited = new Set()
  function visit(directory, isRoot = false) {
    const realDirectory = realpathSync(directory)
    const fromRoot = relative(realRoot, realDirectory)
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot) || visited.has(realDirectory))
      return
    visited.add(realDirectory)
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules' || (isRoot && generatedRoots.has(entry.name))) continue
      const path = join(directory, entry.name)
      if (entry.name.endsWith('.svelte') && !entry.isDirectory()) return path
      let isDirectory = entry.isDirectory()
      if (entry.isSymbolicLink()) {
        try {
          isDirectory = statSync(path).isDirectory()
        } catch (error) {
          if (error.code === 'ENOENT' || error.code === 'ELOOP') continue
          throw error
        }
      }
      if (isDirectory) {
        const found = visit(path)
        if (found) return found
      }
    }
  }
  return visit(root, true)
}

function parcelConfig(root) {
  const manifestPath = join(root, 'package.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const projectRequire = createRequire(manifestPath)
  const plasmoRequire = createRequire(projectRequire.resolve('plasmo/package.json'))
  const configPath = plasmoRequire.resolve('@plasmohq/parcel-config/package.json')
  const config = plasmoRequire(configPath)
  const target = '@plasmohq/parcel-transformer-svelte'
  const selectors = [target, `@plasmohq/parcel-config>${target}`, `@plasmohq/parcel-config@${config.version}>${target}`]
  return { configPath, removed: selectors.some((selector) => manifest.pnpm?.overrides?.[selector] === '-') }
}

export function svelteTransformerRemoved(root) {
  return parcelConfig(root).removed
}

export function directSvelteTransformer(root) {
  try {
    const { configPath, removed } = parcelConfig(root)
    if (removed) return undefined
    const direct = join(dirname(dirname(configPath)), 'parcel-transformer-svelte')
    return createRequire(configPath).resolve(direct)
  } catch {
    return undefined
  }
}

export function checkSvelteInputs(root) {
  const input = findSvelteInput(root)
  if (input && !directSvelteTransformer(root)) {
    throw new Error(
      `Svelte input: ${relative(root, input)} / Svelte 输入: ${relative(root, input)}\n` +
        'Adding Svelte inputs requires restoring the Parcel Svelte transformer and reinstalling dependencies. / 添加 Svelte 输入需要恢复 Parcel Svelte 转换器并重新安装依赖。'
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkSvelteInputs(process.cwd())
  } catch (error) {
    console.error('Svelte input check failed / Svelte 输入检查失败:', error.message)
    process.exitCode = 1
  }
}
