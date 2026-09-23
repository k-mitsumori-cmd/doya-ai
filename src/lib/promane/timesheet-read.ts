import { Prisma } from '@prisma/client'

export function parseTimesheetQuery(params: { month?: string | string[]; cursor?: string | string[] }) {
  const month = params.month ?? ''
  if (typeof month !== 'string' || (month && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')))) throw new Error('Invalid month')
  let range: { gte: Date; lt: Date } | undefined
  if (month) {
    const gte = new Date(`${month}-01T00:00:00.000Z`)
    const lt = new Date(gte); lt.setUTCMonth(lt.getUTCMonth() + 1)
    range = { gte, lt }
  }
  let cursor: { id: string; date: Date; memberId: string } | null = null
  if (params.cursor !== undefined) {
    const raw = params.cursor
    if (typeof raw !== 'string' || !raw || raw.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor')
    const data = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!data || data.v !== 1 || data.month !== month || [data.id, data.memberId].some(v => typeof v !== 'string' || !v || v.length > 128) || typeof data.date !== 'string') throw new Error('Invalid cursor')
    const date = new Date(data.date)
    if (!Number.isFinite(+date) || date.toISOString() !== data.date) throw new Error('Invalid cursor')
    cursor = { id: data.id, memberId: data.memberId, date }
  }
  return { month, range, cursor }
}

export async function readTimesheet(db: Prisma.TransactionClient, userId: string, workspaceSlug: string, query: ReturnType<typeof parseTimesheetQuery>) {
  const member = await db.promaneMember.findFirst({ where: { userId, isActive: true, workspace: { slug: workspaceSlug } }, select: { id: true, workspaceId: true } })
  if (!member) return null
  if (query.cursor && query.cursor.memberId !== member.id) throw new Error('Invalid cursor')
  const where = { memberId: member.id, ...(query.range ? { date: query.range } : {}) }
  const totals = await db.promaneTimeEntry.aggregate({ where, _count: { _all: true }, _sum: { duration: true } })
  const cursor = query.cursor
  const rows = await db.promaneTimeEntry.findMany({
    where: { ...where, ...(cursor ? { OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }] } : {}) },
    select: { id: true, taskId: true, duration: true, date: true, note: true,
      project: { select: { name: true } }, task: { select: { title: true, project: { select: { name: true } } } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 51,
  })
  const entries = rows.slice(0, 50)
  const last = entries.at(-1)
  const nextCursor = rows.length > 50 && last ? Buffer.from(JSON.stringify({ v: 1, month: query.month, id: last.id, date: last.date.toISOString(), memberId: member.id })).toString('base64url') : null
  const projects = await db.promaneProject.findMany({ where: { workspaceId: member.workspaceId }, select: { id: true, name: true, tasks: { select: { id: true, title: true } } }, orderBy: { name: 'asc' } })
  return { memberId: member.id, entries, projects, nextCursor, totalCount: totals._count._all, totalMinutes: totals._sum.duration ?? 0 }
}
