const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  const objects = new Map()
  const pending = new Map()
  const calls = []
  let bucket = null
  const storage = {
    getBucket: async name => {
      calls.push(['getBucket', name])
      return bucket ? { data: bucket, error: null } : { data: null, error: { status: 400, statusCode: '404' } }
    },
    createBucket: async (name, options) => {
      calls.push(['createBucket', name, options])
      bucket = { name, public: options.public }
      return { data: bucket, error: null }
    },
    from: name => ({
      upload: async (key, buf, options) => {
        calls.push(['upload', name, key, options])
        objects.set(key, Buffer.from(buf))
        return { data: { path: key }, error: null }
      },
      download: async key => {
        calls.push(['download', name, key])
        const buf = objects.get(key)
        return buf ? { data: new Blob([buf]), error: null } : { data: null, error: { statusCode: '404' } }
      },
      remove: async keys => {
        calls.push(['remove', name, keys])
        for (const key of keys) objects.delete(key)
        return { data: keys, error: null }
      },
    }),
  }
  const mocks = {
    'node:fs': fs,
    'node:path': path,
    'node:crypto': crypto,
    '@supabase/supabase-js': { createClient: () => ({ storage }) },
    '@/lib/prisma': { prisma: { systemSetting: { create: async ({ data }) => { pending.set(data.key, data.value); return data } } } },
  }
  const env = { VERCEL: '1', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test' }
  const create = () => load('seo/lib/storage.ts', mocks, { process: { cwd: () => '/var/task', env }, Blob })
  const writer = create()
  await check('serverless SEO images use a private durable bucket and survive a new instance', async () => {
    const saved = await writer.saveBase64ToFile({ base64: Buffer.from('test-png').toString('base64'), filename: 'image.png', subdir: 'images' })
    assert.match(saved.relativePath, /^supabase:images\/image_[\w-]+\.png$/)
    assert.equal(saved.absolutePath, '')
    assert.equal(calls.filter(call => call[0] === 'createBucket').length, 1)
    assert.equal(bucket.public, false)
    assert.equal(calls.find(call => call[0] === 'upload')[3].upsert, false)
    assert.equal(pending.size, 1)
    assert.equal(JSON.parse([...pending.values()][0]).path, saved.relativePath)
    const reader = create()
    assert.equal((await reader.readFileAsBuffer(saved.relativePath)).toString(), 'test-png')
    await assert.rejects(reader.readFileAsBuffer('supabase:images/../secret.png'))
  })
  await check('missing durable image reports ENOENT and never falls back to ephemeral files', async () => {
    await assert.rejects(create().readFileAsBuffer('supabase:images/missing.png'), { code: 'ENOENT' })
  })
  await check('durable deletion accepts only generated image paths', async () => {
    const image = await create().saveBase64ToFile({ base64: 'AA==', filename: 'delete.png', subdir: 'images' })
    await assert.rejects(create().removeSeoStoredImages([image.relativePath, 'supabase:images/../other.png']))
    assert.equal(objects.size, 2)
    await create().removeSeoStoredImages([image.relativePath, 'images/legacy.png'])
    assert.equal(objects.size, 1)
  })
  await check('public bucket is rejected before storing private images', async () => {
    bucket = { name: 'seo-generated-images', public: true }
    await assert.rejects(create().saveBase64ToFile({ base64: 'AA==', filename: 'image.png', subdir: 'images' }))
  })
  await check('missing server credentials fail closed before any local write', async () => {
    const withoutKey = load('seo/lib/storage.ts', mocks, { process: { cwd: () => '/var/task', env: { VERCEL: '1', SUPABASE_URL: env.SUPABASE_URL } }, Blob })
    await assert.rejects(withoutKey.saveBase64ToFile({ base64: 'AA==', filename: 'image.png', subdir: 'images' }), /not configured/)
  })
  await check('failed pending reservation prevents an untracked upload', async () => {
    bucket = { name: 'seo-generated-images', public: false }
    const before = calls.filter(call => call[0] === 'upload').length
    const blocked = load('seo/lib/storage.ts', {
      ...mocks,
      '@/lib/prisma': { prisma: { systemSetting: { create: async () => { throw Error('database unavailable') } } } },
    }, { process: { cwd: () => '/var/task', env }, Blob })
    await assert.rejects(blocked.saveBase64ToFile({ base64: 'AA==', filename: 'image.png', subdir: 'images' }), /database unavailable/)
    assert.equal(calls.filter(call => call[0] === 'upload').length, before)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
