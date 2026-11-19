import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { expect } from '@playwright/test'
import { reservePlasmoDevPorts } from './manifest-policy-dev-ports.mjs'

const require = createRequire(import.meta.url)
const project = fileURLToPath(new URL('../', import.meta.url))
const cli = join(dirname(dirname(require.resolve('plasmo'))), 'bin/index.mjs')
const policy = "default-src 'self'; script-src 'self'; object-src 'none'; connect-src https://synthetic.invalid"

function launch(root, args) {
  const command = `Plasmo fixture arguments / Plasmo 夹具参数: ${JSON.stringify(args)}\n`
  console.log(command.trim())
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: { ...process.env, NODE_OPTIONS: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = command,
    ended = false,
    resolvedPorts
  const collect = (data) => {
    output = (output + data.toString()).slice(-12000)
    const match = output.match(/Starting dev server on 127\.0\.0\.1:(\d+), HMR on 127\.0\.0\.1:(\d+)\.\.\./)
    if (match && !resolvedPorts) {
      resolvedPorts = { serve: Number(match[1]), hmr: Number(match[2]), reload: Number(match[2]) + 1 }
      console.log(`Plasmo resolved ports / Plasmo 实际解析端口: ${JSON.stringify(resolvedPorts)}`)
    }
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const done = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      ended = true
      resolve({ code, signal })
    })
    child.once('error', (error) => {
      ended = true
      resolve({ error: error.message })
    })
  })
  return {
    done,
    ports: () => resolvedPorts,
    check() {
      assert.equal(ended, false, output)
    },
    async stop() {
      if (ended) return
      if (process.platform === 'win32') await promisify(execFile)('taskkill', ['/pid', String(child.pid), '/t', '/f'])
      else {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch (error) {
          if (error.code !== 'ESRCH') throw error
        }
      }
      await done
    },
    output: () => output
  }
}

for (const code of ['EADDRINUSE', 'EACCES']) {
  test(`allocator reselects an unavailable HMR+1 (${code}) / 分配器重选不可用 HMR+1`, async () => {
    const candidates = [41000, 42000, 43000]
    const requested = []
    const held = new Set()
    const releaseCounts = new Map()
    const ports = await reservePlasmoDevPorts(async (port) => {
      requested.push(port)
      if (port === 42001) throw Object.assign(new Error('Owned port conflict / 自有端口冲突'), { code })
      port ||= candidates.shift()
      held.add(port)
      return {
        port,
        async release() {
          held.delete(port)
          releaseCounts.set(port, (releaseCounts.get(port) ?? 0) + 1)
        }
      }
    })
    assert.deepEqual(requested, [0, 0, 42001, 0, 43001])
    assert.deepEqual([...held], [41000, 43000, 43001])
    assert.deepEqual([ports.servePort, ports.hmrPort, ports.reloadPort], [...held])
    assert.equal(releaseCounts.get(42000), 1)
    await ports.release()
    await ports.release()
    assert.equal(held.size, 0)
    assert.ok([...releaseCounts.values()].every((count) => count === 1))
  })
}

test('allocator bounds neighbor selection and releases failed reservations / 分配器限制相邻选择次数并释放失败预留', async () => {
  let attempts = 0
  const held = new Set()
  await assert.rejects(
    reservePlasmoDevPorts(async (port) => {
      if (port) throw Object.assign(new Error('Owned port conflict / 自有端口冲突'), { code: 'EADDRINUSE' })
      port = 41000 + attempts++
      held.add(port)
      return { port, release: async () => held.delete(port) }
    }),
    /No available Plasmo/
  )
  assert.equal(attempts, 17)
  assert.equal(held.size, 0)
})

test('allocator surfaces unrelated errors and releases held ports / 分配器报告无关错误并释放已保留端口', async () => {
  const held = new Set()
  const failure = Object.assign(new Error('Owned unexpected failure / 自有意外失败'), { code: 'EINVAL' })
  await assert.rejects(
    reservePlasmoDevPorts(async (port) => {
      if (port) throw failure
      port = 41000 + held.size
      held.add(port)
      return { port, release: async () => held.delete(port) }
    }),
    (error) => error === failure
  )
  assert.equal(held.size, 0)
})

test('real allocator holds all three distinct loopback ports until release / 真实分配器保留三个互异回环端口直到释放', async () => {
  const ports = await reservePlasmoDevPorts()
  try {
    const selected = [ports.servePort, ports.hmrPort, ports.reloadPort]
    assert.equal(new Set(selected).size, 3)
    assert.equal(ports.reloadPort, ports.hmrPort + 1)
    for (const port of selected) {
      const server = createServer()
      try {
        await assert.rejects(
          new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, '127.0.0.1', resolve)
          }),
          (error) => ['EADDRINUSE', 'EACCES'].includes(error.code)
        )
      } finally {
        if (server.listening) await new Promise((resolve) => server.close(resolve))
      }
    }
  } finally {
    await ports.release()
  }
})

for (const mode of ['build', 'dev']) {
  test(`real ${mode} manifest preserves explicit CSP / 真实 ${mode} 清单保留显式 CSP`, { timeout: 60000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'ultraforce-policy-build-'))
    let running
    let ports
    try {
      await mkdir(join(root, 'assets'))
      await mkdir(join(root, 'contents'))
      await writeFile(join(root, 'assets/icon.png'), await readFile(join(project, 'assets/icon.png')))
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({ extends: 'plasmo/templates/tsconfig.base', include: ['./**/*.ts'] })
      )
      await writeFile(
        join(root, 'contents/probe.ts'),
        'export const config = { matches: ["https://synthetic.invalid/*"] }; document.documentElement.dataset.synthetic = "true";'
      )
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'synthetic-policy-fixture',
          displayName: 'Synthetic / 合成',
          version: '1.0.0',
          dependencies: { plasmo: '0.90.5' },
          manifest: { content_security_policy: { extension_pages: policy, sandbox: policy + '; sandbox allow-forms' } }
        })
      )
      await symlink(join(project, 'node_modules'), join(root, 'node_modules'), 'junction')
      const args = [mode]
      if (mode === 'dev') {
        ports = await reservePlasmoDevPorts()
        console.log(
          `Plasmo fixture ports / Plasmo 夹具端口: ${JSON.stringify({ serve: ports.servePort, hmr: ports.hmrPort, reload: ports.reloadPort })}`
        )
        args.push(
          `--serve-port=${ports.servePort}`,
          `--hmr-port=${ports.hmrPort}`,
          '--serve-host=127.0.0.1',
          '--hmr-host=127.0.0.1',
          '--verbose'
        )
        // CLI owns binding after release; external races remain possible. / 释放后由 CLI 绑定，仍可能存在外部竞态。
        await ports.release()
      }
      running = launch(root, args)
      const path = join(root, 'build', mode === 'dev' ? 'chrome-mv3-dev' : 'chrome-mv3-prod', 'manifest.json')
      if (mode === 'build') {
        const result = await running.done
        assert.equal(result.code, 0, running.output())
      } else {
        await expect
          .poll(
            async () => {
              running.check()
              try {
                return JSON.parse(await readFile(path, 'utf8')).content_security_policy.extension_pages
              } catch (error) {
                if (error.code === 'ENOENT' || error instanceof SyntaxError) return ''
                throw error
              }
            },
            {
              timeout: 45000,
              intervals: [100, 250, 500],
              message: 'Wait for compiled development policy / 等待已编译开发策略'
            }
          )
          .toContain('http://localhost')
      }
      const result = JSON.parse(await readFile(path, 'utf8')).content_security_policy
      if (mode === 'dev')
        assert.deepEqual(
          running.ports(),
          { serve: ports.servePort, hmr: ports.hmrPort, reload: ports.reloadPort },
          'Plasmo uses the validated listener set / Plasmo 使用已验证的监听集合'
        )
      for (const key of ['extension_pages', 'sandbox']) {
        assert.ok(result[key].includes("object-src 'none'"), running.output())
        assert.ok(result[key].includes('connect-src https://synthetic.invalid'), running.output())
      }
      if (mode === 'build')
        assert.deepEqual(result, { extension_pages: policy, sandbox: policy + '; sandbox allow-forms' })
    } finally {
      await ports?.release()
      await running?.stop()
      await rm(root, { recursive: true, force: true })
    }
  })
}
