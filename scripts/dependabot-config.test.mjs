import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parse } from 'yaml'

const config = parse(await readFile(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'))

for (const ecosystem of ['npm', 'github-actions']) {
  test(`${ecosystem} version updates target develop / ${ecosystem} 版本更新指向 develop`, () => {
    const entries = config.updates.filter((entry) => entry['package-ecosystem'] === ecosystem)
    assert.equal(entries.length, 1)
    assert.equal(entries[0]['target-branch'], 'develop')
  })
}

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
