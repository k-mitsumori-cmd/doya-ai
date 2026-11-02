import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAskLinkUserId, isRunId, ownRun } from '@/lib/asklink/access'
import { RUN_SELECT, toRunDto } from '@/lib/asklink/dto'
import { buildLink } from '@/lib/asklink/link'
import type { AskLink } from '@/lib/asklink/types'

type Ctx = { params: Promise<{ id: string }> }

async function resolve(ctx: Ctx) {
  const p = await ctx.params
  return p.id
}

/** 詳細（自分の分だけ。他人のIDは404） */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const userId = await getAskLinkUserId()
  if (!userId) return privateApiJson({ error: 'ログインが必要です。' }, { status: 401 })
  const id = await resolve(ctx)
  if (!isRunId(id)) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
  const run = await prisma.askLinkRun.findFirst({ where: ownRun(userId, id), select: RUN_SELECT })
  if (!run || !Array.isArray(run.links)) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
  return privateApiJson({ run: await toRunDto(run) })
}

/**
 * 質問文・ボタン名の編集を保存する。URLの作り直しと機械チェックはサーバー側でもやり直す
 * （画面側の判定は表示用。保存する値は必ずここで作る）。
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getAskLinkUserId()
  if (!userId) return privateApiJson({ error: 'ログインが必要です。' }, { status: 401 })
  const id = await resolve(ctx)
  if (!isRunId(id)) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
  const initial = await prisma.askLinkRun.findFirst({ where: ownRun(userId, id), select: { id: true, links: true, allowedUrls: true } })
  if (!initial || !Array.isArray(initial.links)) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const edits: { key?: string; buttonLabel?: string; question?: string }[] = Array.isArray(body?.links) ? body.links : []
  for (let attempt = 0; attempt < 5; attempt++) {
    const run = attempt === 0 ? initial : await prisma.askLinkRun.findFirst({ where: ownRun(userId, id), select: { id: true, links: true, allowedUrls: true } })
    if (!run || !Array.isArray(run.links)) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
    const current = run.links as unknown as AskLink[]
    const allowedUrls = (run.allowedUrls as string[]) || []
    const next = current.map((l) => {
      const e = edits.find((x) => x?.key === l.key)
      if (!e) return l
      const question = typeof e.question === 'string' ? e.question.slice(0, 2000) : l.question
      const buttonLabel = typeof e.buttonLabel === 'string' ? e.buttonLabel.slice(0, 60) : l.buttonLabel
      return buildLink(l.key, l.title, buttonLabel, question, allowedUrls)
    })
    // 読んだ配列から変わっていない場合だけ更新する。競合時は最新へ編集を適用し直す。
    const claimed = await prisma.askLinkRun.updateMany({
      where: { ...ownRun(userId, id), links: { equals: run.links as Prisma.InputJsonValue } },
      data: { links: next as any },
    })
    if (claimed.count === 0) continue
    const saved = await prisma.askLinkRun.findFirst({ where: ownRun(userId, id), select: RUN_SELECT })
    if (!saved) return privateApiJson({ error: '見つかりません。' }, { status: 404 })
    return privateApiJson({ run: await toRunDto(saved) })
  }
  return privateApiJson({ error: '同時に更新されたため、保存できませんでした。もう一度お試しください。' }, { status: 409 })
}
