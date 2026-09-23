import type { PrismaClient } from '@prisma/client'
import { isPersonaDisplayData } from './display-data'

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export function isPersonaProjectId(id: string) { return ID.test(id) }

export function parsePersonaHistoryCursor(cursor: string | null) {
  if (!cursor) return null
  if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor')
  const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  if (!value || typeof value.id !== 'string' || !ID.test(value.id) || typeof value.createdAt !== 'string') throw new Error('Invalid cursor')
  const createdAt = new Date(value.createdAt)
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== value.createdAt) throw new Error('Invalid cursor')
  return { id: value.id as string, createdAt }
}

/** Stable seek pagination; deleting a previous page's last row cannot invalidate the cursor. */
export async function listPersonaProjects(db: PrismaClient, userId: string, cursor: ReturnType<typeof parsePersonaHistoryCursor>) {
  const rows = await db.personaProject.findMany({
    where: { userId, status: 'succeeded', deletedAt: null, ...(cursor ? { OR: [
      { createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
    select: { id: true, createdAt: true, data: true },
  })
  const page = rows.slice(0, 20)
  const last = page.at(-1)
  return {
    items: page.map(row => {
      const data = row.data as { persona?: { name?: unknown; occupation?: unknown } } | null
      return { id: row.id, createdAt: row.createdAt.toISOString(),
        name: typeof data?.persona?.name === 'string' ? data.persona.name.slice(0, 200) : 'ペルソナ',
        occupation: typeof data?.persona?.occupation === 'string' ? data.persona.occupation.slice(0, 200) : '',
      }
    }),
    nextCursor: rows.length > 20 && last ? Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() })).toString('base64url') : null,
  }
}

/** Return client fields only: never expose request hashes, leases, storage paths or another owner. */
export async function readPersonaProject(db: PrismaClient, userId: string, id: string) {
  const project = await db.personaProject.findFirst({
    where: { id, userId, status: 'succeeded', deletedAt: null },
    select: { id: true, data: true, sourceUrl: true, createdAt: true, includedImages: true,
      images: { where: { status: 'succeeded', outputRef: { not: null } },
        // Prefer the most recently started successful attempt, not a slower older completion.
        orderBy: [{ leaseExpiresAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, kind: true, slotKey: true },
      },
    },
  })
  if (!project) return null
  if (!isPersonaDisplayData(project.data)) throw new Error('Invalid saved persona')
  const seen = new Set<string>()
  const images = project.images.filter(image => {
    const key = `${image.kind}:${image.slotKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(image => ({ ...image, url: `/api/persona/images/${image.id}` }))
  return {
    id: project.id, data: project.data, sourceUrl: project.sourceUrl ?? null, timestamp: project.createdAt.getTime(), includedImages: project.includedImages,
    portrait: images.find(image => image.kind === 'portrait' && image.slotKey === 'portrait')?.url,
    sceneImages: Object.fromEntries(images.filter(image => image.kind === 'scene').map(image => [image.slotKey, image.url])),
    images,
  }
}
