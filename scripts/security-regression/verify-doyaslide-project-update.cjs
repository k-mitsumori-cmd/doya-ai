const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let identity = 'owner'
let writes = 0
let exists = true
let deletions = 0
const project = { id: 'project', userId: 'owner', title: 'Before' }
const prisma = { doyaSlideProject: {
  findFirst: async ({ where }) => exists && where.id === project.id && where.userId === project.userId ? project : null,
  update: async ({ where, data }) => {
    assert.equal(where.id, 'project')
    assert.equal(where.userId, 'owner')
    writes++
    Object.assign(project, data)
    return { ...project }
  },
  deleteMany: async ({ where }) => {
    assert.equal(where.id, 'project')
    if (!exists || where.userId !== project.userId) return { count: 0 }
    exists = false
    deletions++
    return { count: 1 }
  },
} }
const api = load('src/app/api/doyaslide/projects/[id]/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/doyaslide/access': { getUserId: async () => identity },
  '@/lib/doyaslide/constants': {
    STYLE_PRESETS: [{ value: 'corporate' }],
    ASPECT_TO_SIZE: { wide: '1536x1024', square: '1024x1024' },
  },
})
const patch = body => api.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'project' }) })

;(async () => {
  await check('DoyaSlide project update rejects invalid and unknown fields before writing', async () => {
    for (const body of [null, [], {}, { title: null }, { title: '  ' }, { title: 2 },
      { themeColor: 'red' }, { stylePreset: 'unknown' }, { aspectRatio: 'invalid' },
      { customBrief: {} }, { customBrief: 'a'.repeat(20001) }, { status: 'completed' }]) {
      const response = await patch(body)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 100))
    }
    assert.equal(writes, 0)
  })

  await check('DoyaSlide project update keeps ownership checks and normalizes valid input', async () => {
    identity = null
    assert.equal((await patch({ title: 'New' })).status, 401)
    identity = 'other'
    assert.equal((await patch({ title: 'New' })).status, 404)
    assert.equal(writes, 0)
    identity = 'owner'
    const response = await patch({ title: '  Updated  ', themeColor: '#112233', stylePreset: 'corporate', aspectRatio: 'square', customBrief: '' })
    assert.equal(response.status, 200)
    const updated = (await response.json()).project
    assert.equal(updated.title, 'Updated')
    assert.equal(updated.customBrief, null)
    assert.equal(updated.aspectRatio, 'square')
    assert.equal(writes, 1)
  })

  await check('DoyaSlide project deletion is owner-scoped at the write', async () => {
    const ctx = { params: Promise.resolve({ id: 'project' }) }
    identity = null
    assert.equal((await api.DELETE({}, ctx)).status, 401)
    identity = 'other'
    assert.equal((await api.DELETE({}, ctx)).status, 404)
    assert.equal(deletions, 0)
    identity = 'owner'
    assert.equal((await api.DELETE({}, ctx)).status, 200)
    assert.equal(deletions, 1)
    assert.equal((await api.DELETE({}, ctx)).status, 404)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
