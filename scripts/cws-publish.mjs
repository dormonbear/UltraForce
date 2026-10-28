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

// Never expose response bodies, tokens, JWTs or raw exceptions. / 不输出响应内容、令牌、JWT 或原始异常。
function fail(message) {
  console.error(message)
  process.exit(1)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function readResponse(response, message) {
  if (!response.ok) fail(message)
  let data
  try {
    data = await response.json()
  } catch {
    fail(message)
  }
  if (!isObject(data) || Object.hasOwn(data, 'error')) fail(message)
  return data
}

// Fetch failures may contain credential-bearing request details. / fetch 异常可能含请求凭据。
async function request(url, options) {
  try {
    return await fetch(url, options)
  } catch {
    fail('Request failed. / 请求失败。')
  }
}

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

  const res = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  })

  const message = 'Failed to get access token. / 获取访问令牌失败。'
  const data = await readResponse(res, message)
  if (typeof data.access_token !== 'string' || !data.access_token.trim()) {
    fail(message)
  }
  return data.access_token
}

async function main() {
  const opts = parseArgs(args.slice(1))

  if (command === 'upload') {
    if (!opts.zip || !opts['extension-id'] || !opts.key) {
      console.error('Usage: cws-publish.mjs upload --zip <path> --extension-id <id> --key <key.json>')
      process.exit(1)
    }

    const token = await getAccessToken(opts.key)
    const zipData = readFileSync(opts.zip)

    console.log('Uploading to Chrome Web Store... / 正在上传至 Chrome 应用商店……')
    const res = await request(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${opts['extension-id']}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2'
      },
      body: zipData
    })

    const message = 'Upload failed or is incomplete. / 上传失败或尚未完成。'
    const result = await readResponse(res, message)
    // IN_PROGRESS is not completion; retry after checking the draft. / IN_PROGRESS 尚未完成；检查草稿后重试。
    if (
      result.uploadState !== 'SUCCESS' ||
      (Object.hasOwn(result, 'itemError') && (!Array.isArray(result.itemError) || result.itemError.length > 0))
    ) {
      fail(message)
    }
    console.log('Upload complete: SUCCESS. / 上传完成：SUCCESS。')
  } else if (command === 'publish') {
    if (!opts['extension-id'] || !opts.key) {
      console.error('Usage: cws-publish.mjs publish --extension-id <id> --key <key.json>')
      process.exit(1)
    }

    const token = await getAccessToken(opts.key)

    console.log('Submitting to Chrome Web Store for review... / 正在提交至 Chrome 应用商店审核……')
    const res = await request(`https://www.googleapis.com/chromewebstore/v1.1/items/${opts['extension-id']}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2',
        'Content-Length': '0'
      }
    })

    const message = 'Publish submission failed. / 发布提交失败。'
    const result = await readResponse(res, message)
    // v1 OK means submission for review; already-under-review requests fail. / v1 OK 表示送审成功；已在审核的重复请求失败。
    if (
      !Array.isArray(result.status) ||
      result.status.length === 0 ||
      !result.status.every((status) => status === 'OK') ||
      (Object.hasOwn(result, 'statusDetail') &&
        (!Array.isArray(result.statusDetail) || !result.statusDetail.every((detail) => typeof detail === 'string')))
    ) {
      fail(message)
    }
    console.log(
      'Publish submission accepted: OK; review required before publication. / 发布提交已接受：OK；上线前须经审核。'
    )
  } else {
    console.error('Unknown command. Use "upload" or "publish".')
    process.exit(1)
  }
}

main().catch(() => fail('Publisher failed. / 发布器失败。'))
