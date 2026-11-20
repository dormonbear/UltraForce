import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parse } from 'yaml'

const config = parse(await readFile(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'))

for (const [ecosystem, directories] of [
  ['npm', ['/', '/docs']],
  ['github-actions', ['/']]
]) {
  test(`${ecosystem} version updates target develop / ${ecosystem} 版本更新指向 develop`, () => {
    const entries = config.updates.filter((entry) => entry['package-ecosystem'] === ecosystem)
    assert.deepEqual(entries.map((entry) => entry.directory).sort(), directories)
    for (const entry of entries) {
      assert.equal(entry['target-branch'], 'develop', entry.directory)
    }
  })
}

test('docs npm updates follow the root policy with separate groups / 文档站 npm 更新沿用根目录策略并使用独立分组', () => {
  const npm = config.updates.filter((entry) => entry['package-ecosystem'] === 'npm')
  const root = npm.find((entry) => entry.directory === '/')
  const docs = npm.find((entry) => entry.directory === '/docs')

  for (const field of ['schedule', 'open-pull-requests-limit', 'labels', 'commit-message']) {
    assert.deepEqual(docs[field], root[field], field)
  }
  assert.deepEqual(
    docs.groups,
    Object.fromEntries(Object.entries(root.groups).map(([name, group]) => [`docs-${name}`, group]))
  )
  for (const name of Object.keys(docs.groups)) {
    assert.equal(Object.hasOwn(root.groups, name), false, name)
  }
})

for (const [file, job] of [
  ['ci.yml', 'lint-and-typecheck'],
  ['release.yml', 'release']
]) {
  test(`${file} enforces the dependency-target contract / ${file} 执行依赖目标契约`, async () => {
    const workflow = parse(await readFile(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'))
    const step = workflow.jobs[job].steps.find((entry) =>
      entry.run?.split(/\s+/).includes('scripts/dependabot-config.test.mjs')
    )
    assert.ok(step)
    assert.equal(step.if, undefined)
    assert.notEqual(step['continue-on-error'], true)
  })
}
