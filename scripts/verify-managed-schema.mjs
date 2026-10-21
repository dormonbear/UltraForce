#!/usr/bin/env node

/**
 * CI assertion: the built extension must ship the managed storage policy schema.
 * A future Plasmo upgrade could silently stop bundling storage.managed_schema
 * while the build still succeeds - every managed org would then degrade to
 * unmanaged with no error anywhere. Fail the job instead.
 * Usage: node scripts/verify-managed-schema.mjs [buildDir]
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const buildDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), 'build', 'chrome-mv3-prod')
const manifestPath = resolve(buildDir, 'manifest.json')

if (!existsSync(manifestPath)) {
  console.error(`FAIL: no manifest.json in ${buildDir} - did the build run?`)
  process.exit(1)
}

let manifest
const raw = readFileSync(manifestPath, 'utf-8')
try {
  manifest = JSON.parse(raw)
} catch {
  console.error(`FAIL: manifest.json in ${buildDir} is not valid JSON`)
  process.exit(1)
}
const schemaPath = manifest.storage?.managed_schema

if (!schemaPath) {
  console.error('FAIL: manifest.json is missing storage.managed_schema')
  process.exit(1)
}

if (!existsSync(resolve(buildDir, schemaPath))) {
  console.error(`FAIL: storage.managed_schema names "${schemaPath}" but that file is not in the build output`)
  process.exit(1)
}

console.log(`OK: managed schema shipped at ${schemaPath}`)
