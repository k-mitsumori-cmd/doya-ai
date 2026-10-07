export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

import { crmJson, crmError, crmRecovery, crmCreate, crmCancel } from '@/lib/sfa/crm-record-http'

// GET /api/sfa/contacts — 担当者一覧（accountId/q で絞り込み可・取引先名つき）
export async function GET(req: NextRequest) {
  try {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  if (url.searchParams.has('operationId')) return await crmRecovery(req, ctx, 'contact')
  const accountId = url.searchParams.get('accountId')?.trim()
  const q = url.searchParams.get('q')?.trim() || ''
  if (q.length > 100) return crmJson({ error: '検索条件が長すぎます' }, { status: 400 })

  let cursor: { updatedAt: Date; id: string } | null = null
  const rawCursor = url.searchParams.get('cursor')
  if (rawCursor) {
    try {
      if (rawCursor.length > 512) throw new Error('Cursor too long')
      const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { updatedAt?: unknown; id?: unknown }
      if (typeof decoded.updatedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) throw new Error('Invalid cursor')
      const updatedAt = new Date(decoded.updatedAt)
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== decoded.updatedAt) throw new Error('Invalid date')
      cursor = { updatedAt, id: decoded.id }
    } catch {
      return crmJson({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const baseWhere: Prisma.SfaContactWhereInput = {
    organizationId: ctx.organizationId,
    isActive: true,
    ...(accountId ? { accountId } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const pageWhere: Prisma.SfaContactWhereInput = cursor
    ? { AND: [baseWhere, { OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
    ] }] }
    : baseWhere
  const [rows, totalCount] = await Promise.all([
    prisma.sfaContact.findMany({ where: pageWhere, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 201 }),
    prisma.sfaContact.count({ where: baseWhere }),
  ])
  const contacts = rows.slice(0, 200)

  // 取引先名を付与
  const accIds = Array.from(new Set(contacts.map((c) => c.accountId).filter(Boolean))) as string[]
  const accs = accIds.length
    ? await prisma.sfaAccount.findMany({ where: { id: { in: accIds }, organizationId: ctx.organizationId }, select: { id: true, name: true } })
    : []
  const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
  const withName = contacts.map((c) => ({ ...c, accountName: c.accountId ? accMap[c.accountId] || null : null }))

  const last = contacts[contacts.length - 1]
  return crmJson({
    contacts: withName,
    totalCount,
    nextCursor: rows.length > 200 && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return crmError(error) }
}


export async function POST(req: NextRequest) { return crmCreate(req, 'contact') }
export async function DELETE(req: NextRequest) { return crmCancel(req, 'contact') }
