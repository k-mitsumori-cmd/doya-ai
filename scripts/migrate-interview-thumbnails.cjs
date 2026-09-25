// One-time, resumable migration of legacy interview thumbnails from DB data URLs
// to the existing private interview Storage bucket. Dry-run unless --apply is set.
const { randomUUID, createHash } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@supabase/supabase-js')

process.loadEnvFile('.env.local')
const apply = process.argv.includes('--apply')
const marker = 'interview-thumbnail-storage:v1'
const bucketName = process.env.INTERVIEW_STORAGE_BUCKET || 'interview-materials'
const safePart = /^[A-Za-z0-9_-]{1,128}$/
const maxBytes = 8 * 1024 * 1024
const db = new PrismaClient()

function parseImage(value) {
  const comma = value.indexOf(',')
  const contentType = value.slice(5, comma === -1 ? undefined : comma).replace(';base64', '')
  const encoded = comma === -1 ? '' : value.slice(comma + 1)
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType) ||
    !value.startsWith(`data:${contentType};base64,`) || !encoded ||
    encoded.length > Math.ceil(maxBytes / 3) * 4 + 4 || /[^A-Za-z0-9+/=]/.test(encoded)) {
    throw new Error('Unsupported legacy thumbnail')
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== encoded) {
    throw new Error('Invalid legacy thumbnail')
  }
  return { contentType, bytes }
}

async function claimLease(id) {
  const key = `interview-thumbnail-lease:v1:${id}`
  const now = Date.now()
  const token = `${now + 360_000}:${randomUUID()}`
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const expiresAt = Number(row.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt)) throw new Error('Invalid thumbnail lease')
      if (expiresAt > now) throw new Error('Thumbnail generation in progress')
    }
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } })
  }, { timeout: 15_000 })
  return { key, token }
}

async function main() {
  const rows = await db.interviewProject.findMany({
    where: { thumbnailUrl: { startsWith: 'data:' } },
    select: { id: true, userId: true, guestId: true, thumbnailUrl: true },
    orderBy: { id: 'asc' },
  })
  const totalBytes = rows.reduce((sum, row) => sum + (row.thumbnailUrl?.length || 0), 0)
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', count: rows.length, encodedCharacters: totalBytes }))
  if (!apply || !rows.length) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Private Storage credentials unavailable')
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage
  const { data: bucket, error: bucketError } = await storage.getBucket(bucketName)
  if (bucketError || !bucket || bucket.public) throw new Error('Private interview bucket unavailable')

  let migrated = 0
  let skipped = 0
  for (const row of rows) {
    if (!safePart.test(row.id)) throw new Error('Invalid project ID')
    const owner = row.userId || (row.guestId ? `guest_${row.guestId}` : '')
    if (!safePart.test(owner)) throw new Error('Invalid project owner')
    const lease = await claimLease(row.id)
    try {
      const current = await db.interviewProject.findUnique({ where: { id: row.id }, select: { thumbnailUrl: true } })
      if (current?.thumbnailUrl !== row.thumbnailUrl) { skipped++; continue }
      const { bytes, contentType } = parseImage(row.thumbnailUrl)
      const path = `${owner}/${row.id}/thumbnail`
      const files = storage.from(bucketName)
      const uploaded = await files.upload(path, bytes, { contentType, cacheControl: '0', upsert: true })
      if (uploaded.error) throw new Error('Thumbnail upload failed')
      const downloaded = await files.download(path)
      if (downloaded.error || !downloaded.data) throw new Error('Thumbnail verification download failed')
      const saved = Buffer.from(await downloaded.data.arrayBuffer())
      if (saved.length !== bytes.length ||
        createHash('sha256').update(saved).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) {
        throw new Error('Thumbnail verification mismatch')
      }
      const changed = await db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${row.id}))`
        return tx.interviewProject.updateMany({
          where: { id: row.id, thumbnailUrl: row.thumbnailUrl },
          data: { thumbnailUrl: marker },
        })
      })
      if (changed.count !== 1) throw new Error('Project changed during thumbnail migration')
      migrated++
    } finally {
      await db.systemSetting.deleteMany({ where: { key: lease.key, value: lease.token } })
    }
  }
  console.log(JSON.stringify({ migrated, skipped, remaining: rows.length - migrated - skipped }))
}

main().catch(error => {
  console.error('Thumbnail migration stopped:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
}).finally(() => db.$disconnect())
