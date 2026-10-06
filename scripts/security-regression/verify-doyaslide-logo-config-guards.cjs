function withMockProjectLock(mocks) { const db=mocks['@/lib/prisma'].prisma; let tail=Promise.resolve(); mocks['@/lib/doyaslide/project-lock']={ withDoyaSlideProjectLock:(_id,_user,work)=>{ const next=tail.then(()=>db.$transaction ? db.$transaction(work) : work(db)); tail=next.catch(()=>{}); return next } }; return mocks }
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const detached = value => ({ ...value, updatedAt: new Date(value.updatedAt), _count: { ...value._count } })
function fixture(mode = 'success') {
  let project = { id: 'project', userId: 'owner', status: 'completed', updatedAt: new Date('2026-10-06T00:00:00Z'), _count: { slides: 0 }, logoUrl: 'https://example.invalid/logo.png', logoSize: 'M', logoPosition: 'top-right', logoBackingChip: false }
  let slide = { id: 'slide', projectId: 'project', status: 'done', version: 1, imageUrl: 'https://example.invalid/image-v1.png', rawImageUrl: 'https://example.invalid/base-v1.png' }
  let uploads = 0, projectWrites = 0, slideWrites = 0, imageReads = 0
  if (mode === 'foreign') project.userId = 'other'
  if (mode === 'missing') project = null
  if (['structuring', 'generating'].includes(mode)) project.status = mode
  if (mode === 'busy_slide') project._count.slides = 1
  if (mode === 'no_logo') project.logoUrl = null
  const conflict = () => { throw Object.assign(Error('SYNTHETIC_PRIVATE'), { code: 'P2025' }) }
  const api = load('src/app/api/doyaslide/projects/[id]/logo-config/route.ts', withMockProjectLock({
    'next/server': { NextResponse: Response },
    '@/lib/doyaslide/access': { getUserId: async () => mode === 'anonymous' ? null : 'owner' },
    '@/lib/prisma': { prisma: {
      doyaSlideProject: {
        findFirst: async ({ where, include }) => {
          assert.equal(where.userId, 'owner')
          if (include?.slides && mode === 'final_owner') project.userId = 'other'
          if (include?.slides && mode === 'final_change') project.updatedAt = new Date(project.updatedAt.getTime() + 100)
          return project && project.id === where.id && project.userId === where.userId ? { ...detached(project), slides: [{ ...slide }] } : null
        },
        update: async ({ where, data }) => {
          assert.equal(where.userId, 'owner')
          assert.ok(where.updatedAt instanceof Date)
          assert.deepEqual(Array.from(where.status.notIn), ['structuring', 'generating'])
          assert.deepEqual(JSON.parse(JSON.stringify(where.slides)), { none: { status: 'generating' } })
          if (!project || project.userId !== where.userId || project.updatedAt.getTime() !== where.updatedAt.getTime() || where.status.notIn.includes(project.status) || project._count.slides) conflict()
          projectWrites++; project = { ...project, ...data, updatedAt: new Date(project.updatedAt.getTime() + 1) }
          return detached(project)
        },
      },
      doyaSlideSlide: {
        findMany: async () => [{ ...slide }],
        update: async ({ where, data }) => {
          assert.equal(where.projectId, 'project'); assert.equal(where.project.userId, 'owner')
          assert.ok(where.project.updatedAt instanceof Date); assert.equal(where.project.logoUrl, 'https://example.invalid/logo.png')
          if (!project || project.userId !== where.project.userId || project.updatedAt.getTime() !== where.project.updatedAt.getTime() || project.logoUrl !== where.project.logoUrl || where.project.status.notIn.includes(project.status) || ['version', 'imageUrl', 'rawImageUrl', 'status'].some(k => slide[k] !== where[k])) conflict()
          slideWrites++; slide = { ...slide, ...data }; return { ...slide }
        },
      },
    } },
    '@/lib/doyaslide/logo': {
      fetchBuffer: async url => {
        imageReads++
        if (url.endsWith('logo.png')) {
          if (mode === 'logo_failure') throw Error('SYNTHETIC_PRIVATE')
          if (mode === 'owner_before_save') project.userId = 'other'
          if (mode === 'change_before_save') project.updatedAt = new Date(project.updatedAt.getTime() + 100)
          if (mode === 'processing_before_save') project.status = 'generating'
          if (mode === 'slide_before_save') project._count.slides = 1
        } else {
          if (mode === 'base_failure') throw Error('SYNTHETIC_PRIVATE')
          if (mode === 'new_version') { slide.version = 2; slide.imageUrl = 'https://example.invalid/new.png'; slide.rawImageUrl = 'https://example.invalid/base-v2.png' }
          if (mode === 'new_slide_image') slide.imageUrl = 'https://example.invalid/new.png'
          if (mode === 'slide_processing') slide.status = 'generating'
          if (mode === 'owner_after_save') project.userId = 'other'
          if (mode === 'branding_after_save') { project.logoUrl = 'https://example.invalid/new-logo.png'; project.updatedAt = new Date(project.updatedAt.getTime() + 100) }
          if (mode === 'processing_after_save') project.status = 'generating'
        }
        return Buffer.from('synthetic')
      },
      compositeLogo: async () => Buffer.from('synthetic'),
    },
    '@/lib/doyaslide/storage': { uploadComposedImage: async () => { uploads++; return 'https://example.invalid/recomposed.png' } },
  }))
  return { run: body => api.PUT({ json: async () => body ?? { logoSize: 'L' } }, { params: Promise.resolve({ id: 'project' }) }), stats: () => ({ uploads, projectWrites, slideWrites, imageReads }), get slide() { return slide }, get project() { return project } }
}
;(async () => {
  await check('logo configuration rejects anonymous, missing and foreign projects without image or storage work', async () => { for (const [mode, status] of [['anonymous',401],['missing',404],['foreign',404]]) { const f=fixture(mode); assert.equal((await f.run()).status,status); assert.deepEqual(f.stats(),{uploads:0,projectWrites:0,slideWrites:0,imageReads:0}) } })
  await check('processing projects and individual generating slides reject branding changes', async () => { for (const mode of ['structuring','generating','busy_slide']) { const f=fixture(mode); assert.equal((await f.run()).status,409); assert.equal(f.stats().projectWrites,0); assert.equal(f.stats().imageReads,0) } })
  await check('logo fetch failure keeps previous settings and does not expose diagnostics', async () => { const f=fixture('logo_failure'),r=await f.run(); assert.equal(r.status,503); assert.equal(f.stats().projectWrites,0); assert.doesNotMatch(JSON.stringify(await r.json()),/SYNTHETIC_PRIVATE/) })
  await check('owner timestamp and processing changes before saving reject stale project writes', async () => { for (const mode of ['owner_before_save','change_before_save','processing_before_save','slide_before_save']) { const f=fixture(mode); assert.equal((await f.run()).status,409,mode); assert.equal(f.stats().projectWrites,0); assert.equal(f.stats().uploads,0) } })
  await check('newer image versions and generating slides cannot be overwritten by stale recomposition', async () => { for (const mode of ['new_version','new_slide_image','slide_processing']) { const f=fixture(mode),r=await f.run(); assert.equal(r.status,503,mode); assert.equal((await r.json()).failedSlides,1); assert.equal(f.stats().slideWrites,0); assert.notEqual(f.slide.imageUrl,'https://example.invalid/recomposed.png') } })
  await check('owner branding and processing changes after saving stop image writes and success claims', async () => { for (const [mode,status] of [['owner_after_save',404],['branding_after_save',409],['processing_after_save',503]]) { const f=fixture(mode),r=await f.run(); assert.equal(r.status,status,mode); assert.equal(f.stats().slideWrites,0); assert.doesNotMatch(JSON.stringify(await r.json()),/SYNTHETIC_PRIVATE/) } })
  await check('final ownership and timestamp checks do not return an unowned or stale confirmed project', async () => { for (const [mode,status] of [['final_owner',404],['final_change',409]]) { const f=fixture(mode),r=await f.run(); assert.equal(r.status,status); assert.equal((await r.json()).project,undefined) } })
  await check('unchanged owned projects save settings and compose images, including projects with no logo', async () => { for (const mode of ['success','no_logo']) { const f=fixture(mode),r=await f.run(); assert.equal(r.status,200); assert.equal((await r.json()).project.logoSize,'L'); assert.equal(f.stats().projectWrites,1); assert.equal(f.stats().slideWrites,mode==='success'?1:0) } })
  console.log(JSON.stringify({passed:results.length,scope:'Actual API with synthetic auth/Prisma/image/Storage and injected state changes. No real DB concurrency, storage writes or paid generation. Conflicts after upload may leave unused storage assets.',results},null,2))
})().catch(error=>{ console.error(error); process.exitCode=1 })
