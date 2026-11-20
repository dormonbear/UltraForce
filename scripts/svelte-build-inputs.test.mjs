import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { parse } from 'yaml'

test('the lockfile has no Svelte compiler or Plasmo Svelte transformer / 锁文件无 Svelte 编译器或 Plasmo Svelte 转换器', async () => {
  const lockfile = parse(await readFile(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
  const entries = [...Object.keys(lockfile.packages), ...Object.keys(lockfile.snapshots)]
  assert.deepEqual(
    entries.filter((id) => /^(svelte|@plasmohq\/parcel-transformer-svelte)@/.test(id)),
    []
  )
})

test('extension sources have no Svelte inputs / 扩展源码无 Svelte 输入', async () => {
  const paths = await readdir(new URL('../src/', import.meta.url), { recursive: true })
  assert.deepEqual(
    paths.filter((path) => /\.svelte$/i.test(path)),
    []
  )
})
