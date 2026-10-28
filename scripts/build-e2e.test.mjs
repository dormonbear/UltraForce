import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

function run(args = [], exitCode = 0) {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const [runtime, ...command] = scripts['build:e2e'].split(' ')
  assert.equal(runtime, 'node', 'Use shell-independent Node dispatch / 使用不依赖 Shell 的 Node 调度')
  // Exercise real child processes from a path containing spaces and Unicode. / 从含空格及 Unicode 的路径启动真实子进程。
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ultraforce-e2e-launcher-')))
  const project = join(root, 'synthetic project 合成')
  try {
    mkdirSync(join(project, 'scripts'), { recursive: true })
    const dependency = join(project, 'node_modules', 'plasmo')
    mkdirSync(join(dependency, 'bin'), { recursive: true })
    copyFileSync(new URL('./build-e2e.mjs', import.meta.url), join(project, 'scripts', 'build-e2e.mjs'))
    writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'plasmo', bin: 'bin/index.mjs' }))
    writeFileSync(
      join(dependency, 'bin', 'index.mjs'),
      `process.stdout.write(JSON.stringify({ args: process.argv.slice(2), flag: process.env.PLASMO_PUBLIC_E2E, inherited: process.env.UF_SYNTHETIC_VALUE, cwd: process.cwd() }) + '\\n'); process.stderr.write('SYNTHETIC_STDERR\\n'); process.exitCode = ${exitCode}`
    )
    const result = spawnSync(process.execPath, [...command, ...args], {
      cwd: project,
      env: { ...process.env, PLASMO_PUBLIC_E2E: 'false', UF_SYNTHETIC_VALUE: 'synthetic / 合成' },
      encoding: 'utf8',
      timeout: 10000
    })
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    return { ...result, project }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('E2E launcher enables only the child flag and preserves environment and cwd / E2E 启动器启用子进程标志并保留环境及目录', () => {
  const original = process.env.PLASMO_PUBLIC_E2E
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    args: ['build'],
    flag: 'true',
    inherited: 'synthetic / 合成',
    cwd: result.project
  })
  assert.equal(process.env.PLASMO_PUBLIC_E2E, original)
})

test('E2E launcher preserves literal arguments without shell expansion / E2E 启动器保留字面参数且不执行 Shell 展开', () => {
  const args = ['--target=chrome-mv3', 'space value', '合成', '$(echo injected)', 'a&b', '"quoted"', '']
  const result = run(args)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).args, ['build', ...args])
})

for (const exitCode of [0, 23]) {
  test(`E2E launcher preserves child exit ${exitCode} and output streams / E2E 启动器保留子进程退出码及输出流`, () => {
    const result = run([], exitCode)
    assert.equal(result.status, exitCode, result.stderr)
    assert.equal(result.stderr, 'SYNTHETIC_STDERR\n')
    assert.equal(JSON.parse(result.stdout).flag, 'true')
  })
}
