import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { expand, fflate, glob, globCli, zip64Fixture } from './build-inputs-fixture.mjs'

const fixture = fileURLToPath(new URL('./build-inputs-fixture.mjs', import.meta.url))

async function withDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'ultraforce-build-inputs-'))
  try {
    await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

// Bound CPU and heap use, and reap only the process group created for this fixture. / 限制 CPU 和堆内存，仅回收本夹具创建的进程组。
function runBounded(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=64', ...args], {
      cwd,
      detached: process.platform !== 'win32',
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const terminate = () => {
      if (!child.pid) return
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      } else {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch (error) {
          if (error.code !== 'ESRCH') throw error
        }
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      terminate()
    }, 5000)
    for (const [stream, append] of [
      [
        child.stdout,
        (text) => {
          stdout += text
        }
      ],
      [
        child.stderr,
        (text) => {
          stderr += text
        }
      ]
    ]) {
      stream.setEncoding('utf8')
      stream.on('data', (text) => {
        append(text)
        if (stdout.length + stderr.length > 65536) terminate()
      })
    }
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      terminate()
      resolve({ code, signal, timedOut, stdout, stderr })
    })
  })
}

function assertSuccess(result) {
  assert.equal(result.timedOut, false, JSON.stringify(result))
  assert.equal(result.code, 0, JSON.stringify(result))
}

test('ZIP64 missing its required extra field fails within the child deadline / 缺少必需附加字段的 ZIP64 在子进程期限内报错', async () => {
  const result = await runBounded([fixture, 'zip64'])
  assertSuccess(result)
  assert.equal(result.stdout, 'ok\n')
})

test('valid ZIP64 still decodes its stored file / 有效 ZIP64 仍能解码存储文件', () => {
  assert.deepEqual(fflate.unzipSync(zip64Fixture(true))['a.txt'], fflate.strToU8('ok'))
})

for (const level of [0, 6]) {
  test(`ZIP roundtrip preserves Unicode names and binary content at level ${level} / ZIP 往返保留 Unicode 文件名及二进制内容`, () => {
    const files = {
      'manifest.json': fflate.strToU8('{"name":"synthetic / 合成"}'),
      'assets/合成.txt': fflate.strToU8('Synthetic archive / 合成归档'),
      'assets/binary.bin': Uint8Array.from([0, 255, 128, 1, 0])
    }
    assert.deepEqual(fflate.unzipSync(fflate.zipSync(files, { level })), files)
  })
}

test(
  'glob CLI passes metacharacters as filename data / glob CLI 将元字符作为文件名数据传递',
  { skip: process.platform === 'win32' },
  async () => {
    await withDirectory(async (directory) => {
      // This POSIX substitution can only create a marker in the owned temporary directory. / 此 POSIX 替换仅可在自有临时目录中创建标记。
      const filename = '$(echo marker>owned-marker).txt'
      await writeFile(join(directory, filename), '')
      const result = await runBounded([globCli, '-c', 'echo', '*.txt'], directory)
      assertSuccess(result)
      assert.equal(existsSync(join(directory, 'owned-marker')), false)
      assert.equal(result.stdout.trim(), filename)
    })
  }
)

test('glob preserves brace, extglob, ignore and dotfile behavior / glob 保留花括号、扩展模式、忽略及点文件行为', async () => {
  await withDirectory(async (directory) => {
    for (const name of ['src/a.ts', 'src/b.tsx', 'src/skip.ts', 'src/note.md', 'src/.hidden.ts']) {
      const filepath = join(directory, name)
      await mkdir(dirname(filepath), { recursive: true })
      await writeFile(filepath, '')
    }
    const options = { cwd: directory, ignore: '**/skip.*' }
    assert.deepEqual(glob.globSync('src/*.{ts,tsx}', options).sort(), [join('src', 'a.ts'), join('src', 'b.tsx')])
    assert.deepEqual((await glob.glob('src/!(*.md)', { ...options, dot: true })).sort(), [
      join('src', '.hidden.ts'),
      join('src', 'a.ts'),
      join('src', 'b.tsx')
    ])
  })
})

test('nested extglob matching finishes within the child deadline / 嵌套扩展模式匹配在子进程期限内完成', async () => {
  const result = await runBounded([fixture, 'extglob'])
  assertSuccess(result)
  assert.equal(result.stdout, 'ok\n')
})

test('zero-step brace ranges terminate with a minimum step of one / 零步长花括号范围按最小步长一终止', async () => {
  const result = await runBounded([fixture, 'zero-step'])
  assertSuccess(result)
  assert.equal(result.stdout, 'ok\n')
})

test('brace expansion preserves ordinary sequences and alternatives / 花括号展开保留常规序列及选项', () => {
  assert.deepEqual(expand('file{03..01}.txt'), ['file03.txt', 'file02.txt', 'file01.txt'])
  assert.deepEqual(expand('{a..e..2}'), ['a', 'c', 'e'])
  assert.deepEqual(expand('x{a,{b,c}}y'), ['xay', 'xby', 'xcy'])
})
