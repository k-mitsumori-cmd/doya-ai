const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const denied = new Response(JSON.stringify({ error: '管理者認証が必要です' }), { status: 401 })

;(async () => {
  await check('SEO template generation and deletion require admin before any side effects', async () => {
    let guardCalls = 0
    let sideEffects = 0
    const requireAdmin = async () => { guardCalls++; return denied.clone() }
    const prisma = { bannerTemplate: {
      create: async () => { sideEffects++; throw Error('must not create') },
      deleteMany: async () => { sideEffects++; throw Error('must not delete') },
      findMany: async () => { sideEffects++; throw Error('must not query') },
    } }
    const generateBanners = async () => { sideEffects++; throw Error('must not generate') }
    const thumbnail = load('src/app/api/seo/template/generate-thumbnails/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/admin-guard': { requireAdmin },
      '@/lib/prisma': { prisma },
      '@/lib/nanobanner': { generateBanners },
    })
    const banners = load('src/app/api/seo/template/banners/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/admin-guard': { requireAdmin },
      '@/lib/nanobanner': { generateBanners, isNanobannerConfigured: () => true },
      '@/app/seo/template/data': { articleTemplates: [] },
    })
    const request = { json: async () => { sideEffects++; throw Error('must not read request') } }
    for (const response of [
      await thumbnail.POST(request), await thumbnail.DELETE(),
      await banners.POST(request), await banners.PUT(request),
    ]) {
      assert.equal(response.status, 401)
      assert.equal((await response.json()).error, '管理者認証が必要です')
    }
    assert.equal(guardCalls, 4)
    assert.equal(sideEffects, 0)
  })

  await check('SEO template listing remains publicly readable', async () => {
    const api = load('src/app/api/seo/template/generate-thumbnails/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/admin-guard': { requireAdmin: async () => { throw Error('GET must remain public') } },
      '@/lib/prisma': { prisma: { bannerTemplate: { findMany: async () => [] } } },
      '@/lib/nanobanner': { generateBanners: async () => {} },
    })
    const response = await api.GET()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).count, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
