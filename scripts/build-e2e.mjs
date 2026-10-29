import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { checkSvelteInputs } from './check-svelte-inputs.mjs'

try {
  checkSvelteInputs(process.cwd())
} catch (error) {
  console.error('Svelte input check failed / Svelte 输入检查失败:', error.message)
  process.exit(1)
}

const require = createRequire(import.meta.url)
const packagePath = require.resolve('plasmo/package.json')
const { bin } = require(packagePath)
// Bypass platform shell assignment and .cmd shims; keep arguments as data. / 绕过平台 Shell 赋值及 .cmd 包装，参数始终作为数据。
const child = spawnSync(process.execPath, [resolve(dirname(packagePath), bin), 'build', ...process.argv.slice(2)], {
  env: { ...process.env, PLASMO_PUBLIC_E2E: 'true' },
  stdio: 'inherit'
})
if (child.error) console.error('E2E_BUILD_START_FAILED / E2E 构建启动失败')
process.exitCode = child.status ?? 1
