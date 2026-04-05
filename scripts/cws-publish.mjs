#!/usr/bin/env node
/**
 * Publish extension to Chrome Web Store using a Google Cloud service account key.
 *
 * Usage:
 *   node scripts/cws-publish.mjs upload --zip <path> --extension-id <id> --key <key.json>
 *   node scripts/cws-publish.mjs publish --extension-id <id> --key <key.json>
 */
import { readFileSync } from 'fs'
import { createSign } from 'crypto'

const args = process.argv.slice(2)
const command = args[0]

/**
 * Parse CLI arguments into a key-value map.
 */
function parseArgs(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      result[key] = argv[i + 1]
      i++
    }
  }
  return result
}

/**
 * Base64url encode a buffer or string.
 */
function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Create a signed JWT and exchange it for a Google OAuth2 access token.
 */
async function getAccessToken(keyPath) {
  const key = JSON.parse(readFileSync(keyPath, 'utf-8'))
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })
  )

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const signature = base64url(signer.sign(key.private_key))
  const jwt = `${header}.${claim}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  })

  const data = await res.json()
  if (!data.access_token) {
    console.error('Failed to get access token:', data)
    process.exit(1)
  }
  return data.access_token
}

const opts = parseArgs(args.slice(1))

if (command === 'upload') {
  if (!opts.zip || !opts['extension-id'] || !opts.key) {
    console.error('Usage: cws-publish.mjs upload --zip <path> --extension-id <id> --key <key.json>')
    process.exit(1)
  }

  const token = await getAccessToken(opts.key)
  const zipData = readFileSync(opts.zip)

  console.log(`Uploading ${opts.zip} to Chrome Web Store...`)
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${opts['extension-id']}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2'
      },
      body: zipData
    }
  )

  const result = await res.json()
  console.log('Upload result:', JSON.stringify(result, null, 2))

  if (result.uploadState === 'FAILURE') {
    process.exit(1)
  }
} else if (command === 'publish') {
  if (!opts['extension-id'] || !opts.key) {
    console.error('Usage: cws-publish.mjs publish --extension-id <id> --key <key.json>')
    process.exit(1)
  }

  const token = await getAccessToken(opts.key)

  console.log('Publishing to Chrome Web Store...')
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${opts['extension-id']}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2',
        'Content-Length': '0'
      }
    }
  )

  const result = await res.json()
  console.log('Publish result:', JSON.stringify(result, null, 2))

  if (result.error) {
    process.exit(1)
  }
} else {
  console.error('Unknown command. Use "upload" or "publish".')
  process.exit(1)
}
