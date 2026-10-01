export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { ASPECT_TO_SIZE, STYLE_PRESETS } from '@/lib/doyaslide/constants'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/doyaslide/projects/[id] — プロジェクト詳細（スライド込み）
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: p.id, userId },
      include: {
        slides: { orderBy: { index: 'asc' } },
      },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (e) {
    console.error('[doyaslide/projects/[id] GET]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// PATCH — タイトル等の更新
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const existing = await prisma.doyaSlideProject.findFirst({ where: { id: p.id, userId } })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '更新内容を確認してください' }, { status: 400 })
    }
    const allowed = new Set(['title', 'themeColor', 'stylePreset', 'aspectRatio', 'customBrief'])
    if (Object.keys(body).length === 0 || Object.keys(body).some(key => !allowed.has(key))) {
      return NextResponse.json({ error: '変更できない項目が含まれています' }, { status: 400 })
    }
    const data: { title?: string; themeColor?: string; stylePreset?: string; aspectRatio?: string; customBrief?: string | null } = {}
    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ error: 'タイトルを入力してください' }, { status: 400 })
      data.title = body.title.trim().slice(0, 120)
    }
    if (Object.prototype.hasOwnProperty.call(body, 'themeColor')) {
      if (typeof body.themeColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.themeColor)) return NextResponse.json({ error: 'テーマカラーを確認してください' }, { status: 400 })
      data.themeColor = body.themeColor
    }
    if (Object.prototype.hasOwnProperty.call(body, 'stylePreset')) {
      if (typeof body.stylePreset !== 'string' || !STYLE_PRESETS.some(item => item.value === body.stylePreset)) return NextResponse.json({ error: 'スタイルを確認してください' }, { status: 400 })
      data.stylePreset = body.stylePreset
    }
    if (Object.prototype.hasOwnProperty.call(body, 'aspectRatio')) {
      if (typeof body.aspectRatio !== 'string' || !Object.prototype.hasOwnProperty.call(ASPECT_TO_SIZE, body.aspectRatio)) return NextResponse.json({ error: 'スライド比率を確認してください' }, { status: 400 })
      data.aspectRatio = body.aspectRatio
    }
    if (Object.prototype.hasOwnProperty.call(body, 'customBrief')) {
      if (body.customBrief != null && (typeof body.customBrief !== 'string' || body.customBrief.length > 20000)) return NextResponse.json({ error: '補足の内容を確認してください' }, { status: 400 })
      data.customBrief = body.customBrief || null
    }
    const project = await prisma.doyaSlideProject.update({ where: { id: p.id, userId }, data })
    return NextResponse.json({ project })
  } catch (e) {
    console.error('[doyaslide/projects/[id] PATCH]')
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// DELETE — プロジェクト削除（スライド等はカスケード）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const deleted = await prisma.doyaSlideProject.deleteMany({ where: { id: p.id, userId } })
    if (deleted.count === 0) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[doyaslide/projects/[id] DELETE]')
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
