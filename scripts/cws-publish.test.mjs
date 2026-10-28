import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { after, test } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'cws-publish-test-'))
const keyPath = join(directory, 'key.json')
const zipPath = join(directory, 'fixture.zip')
const preloadPath = join(directory, 'fetch.mjs')
const scriptPath = new URL('./cws-publish.mjs', import.meta.url)
const sentinel = 'SYNTHETIC_SECRET_SENTINEL'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
writeFileSync(keyPath, JSON.stringify({ client_email: 'fixture@example.invalid', private_key: pem }))
writeFileSync(zipPath, Buffer.from('synthetic archive / 合成归档'))
writeFileSync(
  preloadPath,
  `import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
const fixture = JSON.parse(process.env.CWS_TEST_FIXTURE)
let calls = 0
let jwt = ''
process.on('exit', () => writeFileSync(process.env.CWS_TEST_TRACE, JSON.stringify({ calls, jwt })))
globalThis.fetch = async (url, options) => {
  calls++
  let response
  if (calls === 1 && url === 'https://oauth2.googleapis.com/token') {
    assert.equal(options.method, 'POST')
    jwt = new URLSearchParams(options.body).get('assertion')
    assert.match(jwt, /^[\\w-]+\\.[\\w-]+\\.[\\w-]+$/)
    response = fixture.token
  } else if (calls === 2 && url === fixture.url) {
    assert.equal(options.method, fixture.method)
    assert.equal(options.headers.Authorization, 'Bearer SYNTHETIC_SECRET_SENTINEL')
    assert.equal(options.headers['x-goog-api-version'], '2')
    if (fixture.method === 'PUT') assert.ok(Buffer.isBuffer(options.body))
    response = fixture.operation
  } else {
    throw new Error('Unrecognized intercepted request / 未识别的拦截请求')
  }
  if (response.throws) throw new Error('SYNTHETIC_SECRET_SENTINEL')
  return new Response(response.raw ?? JSON.stringify(response.body), { status: response.status ?? 200 })
}
`
)
after(() => rmSync(directory, { recursive: true, force: true }))

function run(
  command,
  operation,
  {
    token = { body: { access_token: sentinel } },
    expected = 1,
    expectedCalls = 2,
    keyContents,
    missingKey,
    missingZip
  } = {}
) {
  const tracePath = join(directory, 'trace.json')
  rmSync(tracePath, { force: true })
  const selectedKeyPath = join(directory, `${sentinel}-key.json`)
  if (keyContents !== undefined) writeFileSync(selectedKeyPath, keyContents)
  else rmSync(selectedKeyPath, { force: true })
  const fixture = {
    token,
    operation,
    method: command === 'upload' ? 'PUT' : 'POST',
    url:
      command === 'upload'
        ? 'https://www.googleapis.com/upload/chromewebstore/v1.1/items/fixture-id'
        : 'https://www.googleapis.com/chromewebstore/v1.1/items/fixture-id/publish'
  }
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      preloadPath,
      scriptPath.pathname,
      command,
      '--extension-id',
      'fixture-id',
      '--key',
      keyContents !== undefined || missingKey ? selectedKeyPath : keyPath,
      ...(command === 'upload' ? ['--zip', missingZip ? join(directory, `${sentinel}.zip`) : zipPath] : [])
    ],
    {
      env: { PATH: process.env.PATH, CWS_TEST_FIXTURE: JSON.stringify(fixture), CWS_TEST_TRACE: tracePath },
      encoding: 'utf8',
      timeout: 10000
    }
  )
  assert.ifError(result.error)
  const output = result.stdout + result.stderr
  assert.doesNotMatch(output, /Error:|node:internal|at getAccessToken/, 'No raw exception output / 不输出原始异常')
  const trace = JSON.parse(readFileSync(tracePath, 'utf8'))
  assert.equal(result.status, expected, 'CLI exit code / CLI 退出码')
  assert.equal(trace.calls, expectedCalls, 'Intercepted request count / 拦截请求数量')
  for (const secret of [sentinel, pem, trace.jwt]) {
    if (secret) assert.ok(!output.includes(secret), 'Secrets stay out of output / 输出不含秘密')
  }
  return output
}

for (const command of ['upload', 'publish']) {
  for (const keyContents of [
    `{${sentinel}`,
    JSON.stringify({ client_email: 'fixture@example.invalid', private_key: sentinel }),
    JSON.stringify({ client_email: 'fixture@example.invalid' })
  ]) {
    test(`${command}: local key failures do not expose contents or paths ${keyContents.length} / 本地密钥失败不暴露内容或路径`, () => {
      run(command, {}, { keyContents, expectedCalls: 0 })
    })
  }
  test(`${command}: missing key does not expose its path / 密钥缺失不暴露路径`, () => {
    run(command, {}, { missingKey: true, expectedCalls: 0 })
  })
}
test('upload: missing ZIP does not expose its path / ZIP 缺失不暴露路径', () => {
  run('upload', {}, { missingZip: true, expectedCalls: 1 })
})

for (const command of ['upload', 'publish']) {
  const success = command === 'upload' ? { uploadState: 'SUCCESS' } : { status: ['OK'] }
  test(`${command}: accepts a successful submission / 接受成功提交`, () => {
    const output = run(command, { body: { ...success, extra: sentinel } }, { expected: 0 })
    assert.match(output, command === 'upload' ? /SUCCESS/ : /OK/)
  })
  for (const status of [400, 401, 403, 429, 500]) {
    test(`${command}: rejects HTTP ${status} despite success fields / 即使含成功字段也拒绝 HTTP 错误`, () => {
      run(command, { status, body: success })
    })
  }
  for (const body of [{}, null, [], 'unexpected', { error: sentinel }, { ...success, error: sentinel }]) {
    test(`${command}: rejects an invalid result ${JSON.stringify(body).replaceAll(sentinel, 'redacted')} / 拒绝无效结果`, () => {
      run(command, { body })
    })
  }
  test(`${command}: rejects malformed JSON without leaking the body / 拒绝格式错误 JSON 且不泄露内容`, () => {
    run(command, { raw: sentinel })
  })
  test(`${command}: suppresses network exception details / 隐藏网络异常详情`, () => {
    run(command, { throws: true })
  })
  for (const token of [
    { status: 403, body: { access_token: sentinel } },
    { body: {} },
    { body: null },
    { body: [] },
    { body: { access_token: '' } },
    { body: { access_token: ' ' } },
    { body: { access_token: 123 } },
    { body: { access_token: sentinel, error: sentinel } },
    { raw: sentinel },
    { throws: true }
  ]) {
    test(`${command}: rejects invalid authentication case ${JSON.stringify(token).replaceAll(sentinel, 'redacted')} / 拒绝无效认证`, () => {
      run(command, { body: success }, { token, expectedCalls: 1 })
    })
  }
}

for (const uploadState of ['FAILURE', 'IN_PROGRESS', 'NOT_FOUND', 'UNKNOWN', '', null, 1]) {
  test(`upload: rejects incomplete state ${uploadState} / 拒绝未完成状态`, () => {
    run('upload', { body: { uploadState } })
  })
}
for (const itemError of [[{ error_code: 'INVALID', error_detail: sentinel }], sentinel, {}]) {
  test(`upload: rejects item errors ${typeof itemError} / 拒绝条目错误`, () => {
    run('upload', { body: { uploadState: 'SUCCESS', itemError } })
  })
}
for (const status of [
  [],
  'OK',
  [null],
  ['UNKNOWN'],
  ['NOT_AUTHORIZED'],
  ['INVALID_DEVELOPER'],
  ['DEVELOPER_NO_OWNERSHIP'],
  ['DEVELOPER_SUSPENDED'],
  ['ITEM_NOT_FOUND'],
  ['ITEM_PENDING_REVIEW'],
  ['ITEM_TAKEN_DOWN'],
  ['PUBLISHER_SUSPENDED'],
  ['OK', 'NOT_AUTHORIZED'],
  ['OK', 'ITEM_PENDING_REVIEW']
]) {
  test(`publish: rejects status ${JSON.stringify(status)} / 拒绝发布状态`, () => {
    run('publish', { body: { status } })
  })
}
test('publish: OK accepts review submission without claiming live publication / OK 接受送审且不声称已上线', () => {
  const output = run(
    'publish',
    { body: { kind: 'chromewebstore#item', item_id: 'fixture-id', status: ['OK'], statusDetail: ['OK.'] } },
    { expected: 0 }
  )
  assert.match(output, /review/i)
})
test('upload: accepts documented resource fields and empty item errors / 接受文档资源字段及空错误列表', () => {
  run(
    'upload',
    { body: { kind: 'chromewebstore#item', id: 'fixture-id', uploadState: 'SUCCESS', itemError: [] } },
    { expected: 0 }
  )
})
for (const statusDetail of [sentinel, [null], {}]) {
  test(`publish: rejects malformed status details ${typeof statusDetail} / 拒绝错误格式的状态详情`, () => {
    run('publish', { body: { status: ['OK'], statusDetail } })
  })
}
