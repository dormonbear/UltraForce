#!/usr/bin/env node

/**
 * CI assertion: the built extension must ship the bundled Inter font files and
 * expose them via web_accessible_resources.
 * The @font-face CSS injected by the content script points at
 * chrome-extension://<id>/assets/fonts/*.woff2. If the files are missing from
 * the build output, or the page origin is not allowed to fetch them (WAR
 * missing/insufficient), the fetch fails silently and the UI falls back to
 * system fonts - the product typography never renders. Fail the job instead.
 * Usage: node scripts/verify-fonts.mjs [buildDir]
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const buildDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), 'build', 'chrome-mv3-prod')
const manifestPath = resolve(buildDir, 'manifest.json')

const REQUIRED_FONTS = ['assets/fonts/inter-latin.woff2', 'assets/fonts/inter-latin-ext.woff2']

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

if (!existsSync(manifestPath)) {
  fail(`no manifest.json in ${buildDir} - did the build run?`)
}

let manifest
const raw = readFileSync(manifestPath, 'utf-8')
try {
  manifest = JSON.parse(raw)
} catch {
  fail(`manifest.json in ${buildDir} is not valid JSON`)
}

// 1. The woff2 files must actually be present in the build output.
for (const font of REQUIRED_FONTS) {
  if (!existsSync(resolve(buildDir, font))) {
    fail(`"${font}" is not in the build output - the @font-face URL will 404`)
  }
}

// 2. The fonts must be listed in web_accessible_resources so host pages
//    (Salesforce org tabs) are allowed to fetch chrome-extension:// URLs.
const war = manifest.web_accessible_resources
if (!Array.isArray(war) || war.length === 0) {
  fail('manifest.json has no web_accessible_resources')
}

const fontEntries = war.filter((entry) => REQUIRED_FONTS.some((font) => (entry.resources || []).includes(font)))
if (fontEntries.length === 0) {
  fail('no web_accessible_resources entry lists the bundled fonts')
}

// 3. The font WAR matches must cover every content-script match pattern,
//    otherwise a page that runs the modal cannot fetch the fonts.
const warMatches = new Set(fontEntries.flatMap((entry) => entry.matches || []))
const csMatches = new Set((manifest.content_scripts || []).flatMap((cs) => cs.matches || []))
const uncovered = [...csMatches].filter((pattern) => {
  // A WAR match covers a content-script pattern when it is a URL-prefix of it
  // (e.g. https://*.salesforce.com/* covers https://*.salesforce.com/lightning/setup/*).
  return ![...warMatches].some((match) => pattern.startsWith(match.replace(/\*$/g, '')))
})
if (uncovered.length > 0) {
  fail(`font web_accessible_resources matches do not cover content-script patterns: ${uncovered.join(', ')}`)
}

console.log(
  `OK: bundled fonts shipped (${REQUIRED_FONTS.join(', ')}) and exposed to ${warMatches.size} match pattern(s)`
)
