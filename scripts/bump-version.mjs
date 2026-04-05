#!/usr/bin/env node

/**
 * Bump the extension version, update release notes placeholder, commit, and tag.
 * Usage: node scripts/bump-version.mjs <major|minor|patch> [--no-tag]
 *
 * Steps:
 *   1. Read current version from package.json
 *   2. Compute next version based on bump type
 *   3. Update package.json version field
 *   4. Prepend a placeholder section in docs/guide/release-notes.md
 *   5. Unless --no-tag, commit and create git tag
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bumpType = process.argv[2]
const noTag = process.argv.includes('--no-tag')

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: node scripts/bump-version.mjs <major|minor|patch> [--no-tag]')
  console.error('  major  1.2.3 -> 2.0.0')
  console.error('  minor  1.2.3 -> 1.3.0')
  console.error('  patch  1.2.3 -> 1.2.4')
  process.exit(1)
}

const pkgPath = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

const nextVersion = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`
}[bumpType]

console.log(`Bumping version: ${pkg.version} -> ${nextVersion} (${bumpType})`)

pkg.version = nextVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('Updated package.json')

const notesPath = resolve(root, 'docs', 'guide', 'release-notes.md')
const notes = readFileSync(notesPath, 'utf-8')
const today = new Date().toISOString().split('T')[0]
const placeholder = [
  '',
  `## v${nextVersion}`,
  '',
  `Release Date: ${today}`,
  '',
  '### New Features',
  '',
  '- (describe new features here)',
  '',
  '### Improvements',
  '',
  '- (describe improvements here)',
  '',
  '### Bug Fixes',
  '',
  '- (describe bug fixes here)',
  ''
].join('\n')

const insertIdx = notes.indexOf('\n## v')
if (insertIdx === -1) {
  writeFileSync(notesPath, notes + placeholder)
} else {
  writeFileSync(notesPath, notes.slice(0, insertIdx) + placeholder + notes.slice(insertIdx))
}
console.log('Updated release-notes.md')

if (!noTag) {
  try {
    execSync('git add package.json docs/guide/release-notes.md', { cwd: root, stdio: 'inherit' })
    execSync(`git commit -m "release: v${nextVersion}"`, { cwd: root, stdio: 'inherit' })
    execSync(`git tag v${nextVersion}`, { cwd: root, stdio: 'inherit' })
    console.log(`\nCreated tag: v${nextVersion}`)
    console.log('\nNext steps:')
    console.log('  1. Edit docs/guide/release-notes.md with actual release notes')
    console.log(`  2. git commit --amend (to update release notes in the tag commit)`)
    console.log(`  3. git push origin develop --tags (to trigger the release workflow)`)
  } catch {
    console.error('Git operations failed. Commit and tag manually.')
    process.exit(1)
  }
} else {
  console.log(`\nVersion bumped to ${nextVersion} (--no-tag: skipped git commit/tag)`)
  console.log('Remember to commit, tag, and push when ready.')
}
