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
const content = readFileSync(notesPath, 'utf-8')

const versionHeader = `## v${version}`
const startIdx = content.indexOf(versionHeader)

if (startIdx === -1) {
  console.log(`Release v${version}\n\nNo release notes found for this version.`)
  process.exit(0)
}

const afterHeader = startIdx + versionHeader.length
const nextSectionIdx = content.indexOf('\n## v', afterHeader)
const section =
  nextSectionIdx === -1
    ? content.slice(afterHeader)
    : content.slice(afterHeader, nextSectionIdx)

const body = section
  .split('\n')
  .filter((line) => !line.startsWith('Release Date:'))
  .join('\n')
  .trim()

console.log(body || `Release v${version}`)
