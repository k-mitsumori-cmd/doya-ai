const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture({ logoFailure = false, slideFailure = false } = {}) {
  let projectWrites = 0
  let slideWrites = 0
  let project = { id: 'project', userId: 'owner', status: 'completed', updatedAt: new Date('2026-10-06T00:00:00Z'), _count: { slides: 0 }, logoUrl: 'https://storage.invalid/logo.png', logoPosition: 'top-right', logoSize: 'M', logoBackingChip: false }
  const prisma = {
    doyaSlideProject: {
      findFirst: async () => project,
      update: async ({ data }) => { projectWrites++; project = { ...project, ...data }; return project },
    },
    doyaSlideSlide: {
      findMany: async () => [{ id: 'slide-a', rawImageUrl: 'https://storage.invalid/a.png' }, { id: 'slide-b', rawImageUrl: 'https://storage.invalid/b.png' }],
      update: async () => { slideWrites++ },
    },
  }
  const route = load('src/app/api/doyaslide/projects/[id]/logo-config/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/doyaslide/access': { getUserId: async () => 'owner' },
    '@/lib/doyaslide/logo': {
      fetchBuffer: async (url) => {
        if (logoFailure && url.endsWith('/logo.png')) throw Error('logo unavailable')
        if (slideFailure && url.endsWith('/b.png')) throw Error('slide unavailable')
        return Buffer.from('image')
      },
      compositeLogo: async () => Buffer.from('composed'),
    },
    '@/lib/doyaslide/storage': { uploadComposedImage: async () => 'https://storage.invalid/composed.png' },
  })
  return {
    run: (body) => route.PUT({ json: async () => body }, { params: Promise.resolve({ id: 'project' }) }),
    stats: () => ({ projectWrites, slideWrites }),
  }
}

;(async () => {
  const invalid = fixture()
  for (const body of [null, [], {}, { logoPosition: 'middle' }, { logoSize: 'XL' }, { logoBackingChip: 'false' }]) {
    assert.equal((await invalid.run(body)).status, 400)
  }
  assert.deepEqual(invalid.stats(), { projectWrites: 0, slideWrites: 0 })

  const logoUnavailable = fixture({ logoFailure: true })
  const logoResponse = await logoUnavailable.run({ logoBackingChip: true })
  assert.equal(logoResponse.status, 503)
  assert.deepEqual(logoUnavailable.stats(), { projectWrites: 0, slideWrites: 0 })

  const partial = fixture({ slideFailure: true })
  const partialResponse = await partial.run({ logoSize: 'L' })
  assert.equal(partialResponse.status, 503)
  assert.equal((await partialResponse.json()).failedSlides, 1)
  assert.deepEqual(partial.stats(), { projectWrites: 1, slideWrites: 1 })

  const complete = fixture()
  assert.equal((await complete.run({ logoPosition: 'bottom-left' })).status, 200)
  assert.deepEqual(complete.stats(), { projectWrites: 1, slideWrites: 2 })
  console.log('PASS DoyaSlide logo settings reject invalid values and report incomplete recomposition')
})().catch((error) => { console.error(error); process.exitCode = 1 })
