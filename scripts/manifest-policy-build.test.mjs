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

const require = createRequire(import.meta.url)
const project = fileURLToPath(new URL('../', import.meta.url))
const cli = join(dirname(dirname(require.resolve('plasmo'))), 'bin/index.mjs')
const policy = "default-src 'self'; script-src 'self'; object-src 'none'; connect-src https://synthetic.invalid"

async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const result = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return result
}

function launch(root, args) {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: { ...process.env, NODE_OPTIONS: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = '',
    ended = false
  const collect = (data) => {
    output = (output + data.toString()).slice(-12000)
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

for (const mode of ['build', 'dev']) {
  test(`real ${mode} manifest preserves explicit CSP / 真实 ${mode} 清单保留显式 CSP`, { timeout: 60000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'ultraforce-policy-build-'))
    let running
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
      if (mode === 'dev')
        args.push(
          `--serve-port=${await port()}`,
          `--hmr-port=${await port()}`,
          '--serve-host=127.0.0.1',
          '--hmr-host=127.0.0.1'
        )
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
      for (const key of ['extension_pages', 'sandbox']) {
        assert.ok(result[key].includes("object-src 'none'"), running.output())
        assert.ok(result[key].includes('connect-src https://synthetic.invalid'), running.output())
      }
      if (mode === 'build')
        assert.deepEqual(result, { extension_pages: policy, sandbox: policy + '; sandbox allow-forms' })
    } finally {
      await running?.stop()
      await rm(root, { recursive: true, force: true })
    }
  })
}
