import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parse } from 'yaml'

// Execute the workflow's own commands, rather than maintaining a duplicate resolver.
const workflow = parse(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'))
const steps = workflow.jobs.release.steps
const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()

function fixture(run) {
  const cwd = mkdtempSync(join(tmpdir(), 'ultraforce-release-binding-'))
  try {
    git(cwd, 'init', '-b', 'main')
    git(cwd, 'config', 'user.name', 'Release Fixture')
    git(cwd, 'config', 'user.email', 'fixture@example.invalid')
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.4.1' }))
    git(cwd, 'add', 'package.json')
    git(cwd, 'commit', '-m', 'Tagged source')
    const sha = git(cwd, 'rev-parse', 'HEAD')
    git(cwd, 'tag', '-a', 'v0.4.1', '-m', 'Annotated release')
    git(cwd, 'tag', 'v0.4.0')
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.4.2' }))
    git(cwd, 'commit', '-am', 'Newer main')
    run({ cwd, sha })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

function interpolate(value, context) {
  return String(value).replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, key) => {
    assert.ok(key in context, `Unsupported fixture expression: ${key}`)
    return context[key]
  })
}

function execute(step, cwd, context, extraEnv = {}) {
  const output = join(cwd, '.step-output')
  writeFileSync(output, '')
  const env = { ...process.env, GITHUB_OUTPUT: output, RUNNER_TEMP: cwd, ...extraEnv }
  for (const [key, value] of Object.entries(step.env || {})) env[key] = interpolate(value, context)
  const result = spawnSync(
    'bash',
    ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', interpolate(step.run, context)],
    {
      cwd,
      env,
      encoding: 'utf8'
    }
  )
  const outputs = Object.fromEntries(
    readFileSync(output, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
  return { ...result, outputs }
}

function select(cwd, { event = 'workflow_dispatch', tag = 'v0.4.1', ref = 'refs/heads/main', eventSha } = {}) {
  const context = {
    'github.event_name': event,
    'inputs.tag': tag,
    'github.event.inputs.tag': tag,
    'github.ref': ref,
    'github.sha': eventSha || git(cwd, 'rev-parse', ref),
    'github.ref_name': ref.replace(/^refs\/(tags|heads)\//, '')
  }
  const target = steps.find((step) => step.id === 'target')
  if (target) {
    const selected = execute(target, cwd, context)
    if (selected.status !== 0) return { ...selected, context }
    for (const [key, value] of Object.entries(selected.outputs)) context[`steps.target.outputs.${key}`] = value
  }
  const checkout = steps.filter((step) => step.uses?.startsWith('actions/checkout@')).at(-1)
  git(cwd, 'checkout', '--detach', interpolate(checkout.with?.ref || context['github.sha'], context))
  return { status: 0, context }
}

test('manual release of older tag checks out that exact commit instead of newer main', () =>
  fixture(({ cwd, sha }) => {
    assert.equal(select(cwd).status, 0)
    assert.equal(git(cwd, 'rev-parse', 'HEAD'), sha)
    assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'))).version, '0.4.1')
  }))

test('lint failure blocks downstream CI and release steps', () => {
  const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
  for (const job of [ci.jobs['lint-and-typecheck'], workflow.jobs.release])
    fixture(({ cwd }) => {
      const bin = join(cwd, 'bin')
      mkdirSync(bin)
      writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexit 19\n', { mode: 0o755 })
      const lint = job.steps.find((step) => step.name === 'Lint')
      const result = execute(lint, cwd, {}, { PATH: `${bin}:${process.env.PATH}` })
      assert.equal(result.status, 19)
      assert.notEqual(lint['continue-on-error'], true, 'Runner would continue past failed lint')
    })
})

for (const event of ['workflow_dispatch', 'push']) {
  for (const tag of ['v0.4.1', 'v0.4.0']) {
    test(`${event} ${tag === 'v0.4.0' ? 'rejects source-version mismatch for' : 'binds source, ZIP, notes and explicit release tag for'} ${tag}`, () =>
      fixture(({ cwd, sha }) => {
        const selected = select(cwd, {
          event,
          tag,
          ref: event === 'push' ? `refs/tags/${tag}` : 'refs/heads/main',
          eventSha: sha
        })
        assert.equal(selected.status, 0, selected.stderr)
        const context = selected.context
        // v0.4.0 intentionally labels package 0.4.1: it must fail at source validation.
        const source = execute(
          steps.find((step) => step.name === 'Verify Release Source'),
          cwd,
          context
        )
        if (tag === 'v0.4.0') {
          assert.notEqual(source.status, 0)
          return
        }
        assert.equal(source.status, 0, source.stderr)
        const build = join(cwd, 'build', 'chrome-mv3-prod')
        mkdirSync(build, { recursive: true })
        writeFileSync(join(build, 'manifest.json'), JSON.stringify({ version: '0.4.1' }))
        assert.equal(
          execute(
            steps.find((step) => step.name === 'Verify Built Version'),
            cwd,
            context
          ).status,
          0
        )
        execFileSync('zip', ['-q', '../chrome-mv3-prod.zip', 'manifest.json'], { cwd: build })
        const pkg = execute(
          steps.find((step) => step.id === 'pkg'),
          cwd,
          context
        )
        assert.equal(pkg.status, 0, pkg.stderr)
        context['steps.pkg.outputs.zip_path'] = pkg.outputs.zip_path
        const packed = execute(
          steps.find((step) => step.name === 'Verify Packaged Version'),
          cwd,
          context
        )
        assert.equal(packed.status, 0, packed.stderr)
        mkdirSync(join(cwd, 'scripts'))
        mkdirSync(join(cwd, 'docs', 'guide'), { recursive: true })
        writeFileSync(
          join(cwd, 'scripts', 'extract-release-notes.mjs'),
          readFileSync(new URL('./extract-release-notes.mjs', import.meta.url))
        )
        writeFileSync(
          join(cwd, 'docs', 'guide', 'release-notes.md'),
          '## v0.4.2\nNew main notes\n## v0.4.1\nTagged notes\n'
        )
        assert.equal(
          execute(
            steps.find((step) => step.name === 'Extract Release Notes'),
            cwd,
            context
          ).status,
          0
        )
        assert.equal(readFileSync(join(cwd, 'release-body.md'), 'utf8').trim(), 'Tagged notes')
        const release = steps.find((step) => step.name === 'Create GitHub Release')
        assert.equal(interpolate(release.with.tag_name, context), tag)
        assert.equal(interpolate(release.with.target_commitish, context), sha)
        assert.equal(interpolate(release.with.name, context), tag)
      }))
  }
}

for (const tag of [
  '',
  'main',
  'refs/tags/v0.4.1',
  'v01.4.1',
  'v0.4.1-beta',
  'v9.9.9',
  'v0.4.1\nsha=bad',
  'v0.4.1$(touch injected)',
  'v0.4.1"; touch injected; #'
]) {
  test(`rejects missing, malformed, injected or nonexistent manual tag ${JSON.stringify(tag)}`, () =>
    fixture(({ cwd }) => {
      assert.notEqual(select(cwd, { tag }).status, 0)
      assert.equal(spawnSync('test', ['-e', join(cwd, 'injected')]).status, 1)
      assert.equal(readFileSync(join(cwd, '.step-output'), 'utf8'), '')
    }))
}

test('tag push rejects branch refs, unsupported events and moved tag SHA', () =>
  fixture(({ cwd }) => {
    for (const input of [
      { event: 'push', ref: 'refs/heads/main' },
      { event: 'pull_request' },
      { event: 'push', ref: 'refs/tags/v0.4.1', eventSha: git(cwd, 'rev-parse', 'HEAD') }
    ])
      assert.notEqual(select(cwd, input).status, 0)
  }))

test('lightweight tags resolve to the same exact commit as annotated tags', () =>
  fixture(({ cwd, sha }) => {
    git(cwd, 'tag', '-d', 'v0.4.1')
    git(cwd, 'tag', 'v0.4.1', sha)
    const selected = select(cwd, { event: 'push', ref: 'refs/tags/v0.4.1', eventSha: sha })
    assert.equal(selected.status, 0)
    assert.equal(git(cwd, 'rev-parse', 'HEAD'), sha)
    assert.equal(
      execute(
        steps.find((step) => step.name === 'Verify Release Source'),
        cwd,
        selected.context
      ).status,
      0
    )
  }))

test('a version-shaped branch cannot substitute for a missing release tag', () =>
  fixture(({ cwd }) => {
    git(cwd, 'branch', 'v9.9.9')
    assert.notEqual(select(cwd, { tag: 'v9.9.9' }).status, 0)
  }))

test('source check rejects checkout drift even if package version matches', () =>
  fixture(({ cwd }) => {
    const selected = select(cwd)
    writeFileSync(join(cwd, 'unrelated.txt'), 'different source')
    git(cwd, 'add', 'unrelated.txt')
    git(cwd, 'commit', '-m', 'Unrelated source')
    assert.notEqual(
      execute(
        steps.find((step) => step.name === 'Verify Release Source'),
        cwd,
        selected.context
      ).status,
      0
    )
  }))

test('source check rejects missing or malformed package metadata', () =>
  fixture(({ cwd }) => {
    const { context } = select(cwd)
    const source = steps.find((step) => step.name === 'Verify Release Source')
    rmSync(join(cwd, 'package.json'))
    assert.notEqual(execute(source, cwd, context).status, 0)
    for (const content of ['{', '{}']) {
      writeFileSync(join(cwd, 'package.json'), content)
      assert.notEqual(execute(source, cwd, context).status, 0)
    }
  }))

test('built and packaged manifest guards reject mismatched, absent and malformed manifests', () =>
  fixture(({ cwd }) => {
    const { context } = select(cwd)
    const build = join(cwd, 'build', 'chrome-mv3-prod')
    mkdirSync(build, { recursive: true })
    const built = steps.find((step) => step.name === 'Verify Built Version')
    assert.notEqual(execute(built, cwd, context).status, 0)
    for (const content of ['{', '{}', '{"version":"0.4.2"}']) {
      writeFileSync(join(build, 'manifest.json'), content)
      assert.notEqual(execute(built, cwd, context).status, 0)
      const zip = join(cwd, 'build', 'chrome-mv3-prod.zip')
      rmSync(zip, { force: true })
      execFileSync('zip', ['-q', zip, 'manifest.json'], { cwd: build })
      context['steps.pkg.outputs.zip_path'] = zip
      assert.notEqual(
        execute(
          steps.find((step) => step.name === 'Verify Packaged Version'),
          cwd,
          context
        ).status,
        0
      )
    }
    context['steps.pkg.outputs.zip_path'] = join(cwd, 'missing.zip')
    assert.notEqual(
      execute(
        steps.find((step) => step.name === 'Verify Packaged Version'),
        cwd,
        context
      ).status,
      0
    )
  }))

test('all version guards precede publication and inputs are not interpolated into shell', () => {
  const index = (name) => steps.findIndex((step) => step.name === name)
  assert.equal(steps[0].with['fetch-depth'], 0)
  assert.ok(index('Checkout Release Commit') < index('Verify Release Source'))
  assert.ok(index('Verify Release Source') < steps.findIndex((step) => step.run === 'pnpm install --frozen-lockfile'))
  for (const guard of ['Verify Built Version', 'Verify Packaged Version']) {
    assert.ok(index(guard) < index('Create GitHub Release'))
    assert.ok(index(guard) < index('Upload to Chrome Web Store'))
    assert.notEqual(steps[index(guard)]['continue-on-error'], true)
  }
  for (const name of ['Create GitHub Release', 'Upload to Chrome Web Store', 'Publish to Chrome Web Store']) {
    // GitHub implicitly adds success() to ordinary conditions. No status-check
    // override may bypass a failed source, archive or lint gate.
    assert.doesNotMatch(steps[index(name)].if || '', /always\(|failure\(|cancelled\(/)
  }
  assert.ok(!steps.find((step) => step.id === 'target').run.includes('${{'))
})

test('packed production UI gates publication / 打包后正式界面验证阻止无效发布', () => {
  const index = (name) => steps.findIndex((step) => step.name === name)
  const smokeIndex = index('Verify Packaged UI / 验证打包后的界面')
  assert.ok(smokeIndex > index('Verify Packaged Version'))
  for (const publication of ['Create GitHub Release', 'Upload to Chrome Web Store', 'Publish to Chrome Web Store']) {
    assert.ok(smokeIndex < index(publication))
  }
  const smoke = steps[smokeIndex]
  assert.notEqual(smoke['continue-on-error'], true)
  assert.doesNotMatch(smoke.if || '', /always\(|failure\(|cancelled\(/)
  assert.match(smoke.run, /unzip -q/)
  assert.match(smoke.run, /EXTENSION_PATH=.*node scripts\/smoke-test\.mjs/)
  assert.equal(smoke.env.ZIP_PATH, '${{ steps.pkg.outputs.zip_path }}')
})

test('publisher regressions gate CI and release / 发布器回归阻止无效 CI 和发布', () => {
  const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
  for (const job of [ci.jobs['lint-and-typecheck'], workflow.jobs.release]) {
    const regression = job.steps.find((step) => step.run === 'node --test scripts/cws-publish.test.mjs')
    assert.ok(regression, 'Missing publisher regression gate / 缺失发布器回归门槛')
    assert.notEqual(regression['continue-on-error'], true)
  }
})

test('publish requires this upload to succeed / 发布要求本次上传成功', () => {
  const upload = steps.find((step) => step.name === 'Upload to Chrome Web Store')
  const publish = steps.find((step) => step.name === 'Publish to Chrome Web Store')
  assert.equal(upload.id, 'cws_upload')
  assert.equal(publish.if, "env.CWS_PUBLISH == 'true' && steps.cws_upload.outcome == 'success'")
  for (const enabled of ['true', 'false']) {
    for (const outcome of ['success', 'failure', 'skipped', 'cancelled']) {
      const condition = publish.if
        .replaceAll('env.CWS_PUBLISH', JSON.stringify(enabled))
        .replaceAll('steps.cws_upload.outcome', JSON.stringify(outcome))
      assert.equal(Function(`return (${condition})`)(), enabled === 'true' && outcome === 'success')
    }
  }
})

test('publisher failures preserve exit codes and always clean the key / 发布器失败保留退出码并始终清理密钥', () =>
  fixture(({ cwd }) => {
    const bin = join(cwd, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'node'), '#!/bin/sh\nexit "$CWS_TEST_EXIT"\n', { mode: 0o755 })
    const upload = steps.find((step) => step.name === 'Upload to Chrome Web Store')
    const publish = steps.find((step) => step.name === 'Publish to Chrome Web Store')
    assert.equal(upload.env.CWS_SERVICE_ACCOUNT_KEY, '${{ secrets.CWS_SERVICE_ACCOUNT_KEY }}')
    assert.match(upload.run, /printf '%s' "\$CWS_SERVICE_ACCOUNT_KEY"/)
    assert.match(upload.run, /umask 077/)
    assert.ok(!upload.run.includes('${{'), 'No shell interpolation of secrets / 不将秘密插入 Shell 源码')
    assert.ok(!publish.run.includes('${{'), 'No shell interpolation of secrets / 不将秘密插入 Shell 源码')
    const cleanup = steps.find((step) => step.name === 'Clean Chrome Web Store Key / 清理 Chrome 应用商店密钥')
    assert.ok(cleanup, 'Missing always-run cleanup / 缺失始终执行的清理')
    assert.equal(cleanup.if, "always() && env.CWS_PUBLISH == 'true'")
    assert.ok(steps.indexOf(cleanup) > steps.indexOf(publish))
    const context = {
      'secrets.CWS_SERVICE_ACCOUNT_KEY': 'synthetic-key',
      'secrets.CWS_EXTENSION_ID': 'fixture-id',
      'steps.pkg.outputs.zip_path': 'fixture.zip'
    }
    const keyPath = join(cwd, 'cws-key.json')
    for (const exit of [0, 23]) {
      const env = { PATH: `${bin}:${process.env.PATH}`, CWS_TEST_EXIT: String(exit) }
      assert.equal(execute(upload, cwd, context, env).status, exit)
      assert.equal(readFileSync(keyPath, 'utf8'), 'synthetic-key')
      assert.equal(execute(publish, cwd, context, env).status, exit)
      assert.equal(execute(cleanup, cwd, context, env).status, 0)
      assert.equal(spawnSync('test', ['-e', keyPath]).status, 1)
    }
  }))
