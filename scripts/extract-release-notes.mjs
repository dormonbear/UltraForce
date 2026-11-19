#!/usr/bin/env node

/**
 * Extract release notes for a specific version from docs/guide/release-notes.md.
 * Usage: node scripts/extract-release-notes.mjs 0.1.1
 * Outputs the markdown body for that version section.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const version = process.argv[2]

if (!version) {
  console.error('Usage: node scripts/extract-release-notes.mjs <version>')
  process.exit(1)
}

const notesPath = resolve(__dirname, '..', 'docs', 'guide', 'release-notes.md')
const lines = readFileSync(notesPath, 'utf-8').split(/\r?\n/)

const versionHeader = `## v${version}`
const startIdx = lines.findIndex((line) => line.trimEnd() === versionHeader)

if (startIdx === -1) {
  console.log(`Release v${version}\n\nNo release notes found for this version.`)
  process.exit(0)
}

const afterHeader = startIdx + 1
const nextSectionIdx = lines.findIndex((line, index) => index >= afterHeader && line.startsWith('## v'))
const body = lines
  .slice(afterHeader, nextSectionIdx === -1 ? undefined : nextSectionIdx)
  .filter((line) => !line.startsWith('Release Date:'))
  .join('\n')
  .trim()

if (/^[ \t]*-[ \t]+\(describe /m.test(body)) {
  console.error(
    `Release notes for v${version} still contain a placeholder. Replace it before publishing. / v${version} 的发布说明仍含占位文本，请替换后再发布。`
  )
  process.exit(1)
}

console.log(body || `Release v${version}`)
