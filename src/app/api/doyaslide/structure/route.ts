export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getUserId } from '@/lib/doyaslide/access'
import { buildStructurePrompt } from '@/lib/doyaslide/prompts'
import { scrapeUrlText } from '@/lib/doyaslide/scrape'
import { serpapiSearchGoogle, hasSerpApiKey } from '@seo/lib/serpapi'
import { errorSuffix } from '@/lib/doyaslide/errors'
import type { SlideStructure } from '@/lib/doyaslide/types'

// POST /api/doyaslide/structure — 資料タイプのひな型でスライド構成を生成
export async function POST(req: NextRequest) {
  let claimedProjectId: string | null = null
  let claimedAt: Date | null = null
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
    }
    const { projectId, referenceText, referenceUrl } = body
    if (typeof projectId !== 'string' || !projectId.trim()
      || (referenceText != null && (typeof referenceText !== 'string' || referenceText.length > 20000))
      || (referenceUrl != null && (typeof referenceUrl !== 'string' || referenceUrl.length > 2048))) {
      return NextResponse.json({ error: '構成生成の入力形式を確認してください' }, { status: 400 })
    }

    const project = await prisma.doyaSlideProject.findFirst({ where: { id: projectId, userId } })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const existingSlides = await prisma.doyaSlideSlide.count({ where: { projectId } })
    if (existingSlides > 0) {
      return NextResponse.json({ error: 'このプロジェクトには構成が存在します。既存のスライドと履歴を保護するため、構成の作り直しはできません。' }, { status: 409 })
    }
    const stale = project.status === 'structuring' && project.updatedAt.getTime() < Date.now() - 6 * 60 * 1000
    if (project.status !== 'draft' && project.status !== 'error' && !stale) {
      return NextResponse.json({ error: '構成を生成中です。完了後にお試しください。' }, { status: 409 })
    }
    const claimTime = new Date()
    const claimed = await prisma.doyaSlideProject.updateMany({
      where: { id: projectId, userId, status: project.status, updatedAt: project.updatedAt, slides: { none: {} } },
      data: { status: 'structuring', updatedAt: claimTime },
    })
    if (claimed.count !== 1) {
      return NextResponse.json({ error: 'プロジェクトの状態が変わりました。再読み込みしてお試しください。' }, { status: 409 })
    }
    claimedProjectId = projectId
    claimedAt = claimTime

    // 参考URLがあれば内容を取得して参考情報に加える（失敗しても構成生成は続行）
    let ref = referenceText || ''
    if (referenceUrl) {
      try {
        const scraped = await scrapeUrlText(referenceUrl)
        ref = `${ref}\n【参考URL: ${scraped.title}】\n${scraped.text}`.trim()
      } catch (e) {
        console.warn('[doyaslide/structure] URL取得スキップ:', (e as any)?.message)
      }
    }

    // Webで調べて原稿の素材にする（SERPER_API_KEY があれば。失敗しても構成生成は続行）
    if (hasSerpApiKey()) {
      try {
        const q = [project.title, project.customBrief].filter(Boolean).join(' ').slice(0, 200)
        const { organic } = await serpapiSearchGoogle({ query: q, gl: 'jp', hl: 'ja', num: 6 })
        if (organic.length) {
          const research = organic
            .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet || ''}\n(${r.url})`)
            .join('\n\n')
          ref = `${ref}\n\n【Web検索の参考情報（最新の事実・数値・具体例の素材）】\n${research}`.trim().slice(0, 6000)
        }
      } catch (e) {
        console.warn('[doyaslide/structure] Web検索スキップ:', (e as any)?.message)
      }
    }

    const prompt = buildStructurePrompt({
      topic: project.title,
      docType: project.docType,
      customBrief: project.customBrief,
      slideCount: project.slideCount,
      referenceText: ref || null,
    })

    const result = await geminiGenerateJson<{ slides: SlideStructure[] }>(
      { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
      'SlideStructure'
    )

    const slides = Array.isArray(result?.slides) ? result.slides : []
    if (slides.length === 0) {
      return NextResponse.json({ error: '構成の生成に失敗しました。もう一度お試しください。' }, { status: 502 })
    }

    // 構成と状態を一括確定し、既存スライドや履歴は一切削除しない。
    await prisma.$transaction(async (tx) => {
      const current = await tx.doyaSlideProject.findFirst({
        where: { id: projectId, userId, status: 'structuring', updatedAt: claimTime },
      })
      if (!current || await tx.doyaSlideSlide.count({ where: { projectId } }) > 0) {
        throw new Error('Structure state changed before save')
      }
      await tx.doyaSlideSlide.createMany({
        data: slides.slice(0, project.slideCount).map((s, i) => ({
          projectId,
          index: i + 1,
          role: typeof s?.role === 'string' ? s.role.slice(0, 120) : null,
          headline: typeof s?.headline === 'string' ? s.headline.slice(0, 500) : null,
          subText: typeof s?.subText === 'string' ? s.subText.slice(0, 10000) : null,
          visualPrompt: typeof s?.visualPrompt === 'string' && s.visualPrompt.trim()
            ? s.visualPrompt.slice(0, 10000)
            : typeof s?.headline === 'string' && s.headline.trim() ? s.headline.slice(0, 500) : project.title,
          status: 'pending',
        })),
      })
      await tx.doyaSlideProject.update({ where: { id: projectId }, data: { status: 'structured' } })
    })
    claimedProjectId = null
    claimedAt = null

    const created = await prisma.doyaSlideSlide.findMany({ where: { projectId }, orderBy: { index: 'asc' } })
    return NextResponse.json({ slides: created })
  } catch (e: any) {
    console.error('[doyaslide/structure]', e?.stack || e?.message)
    return NextResponse.json({ error: `構成の生成に失敗しました${errorSuffix(e)}` }, { status: 500 })
  } finally {
    if (claimedProjectId && claimedAt) {
      await prisma.doyaSlideProject.updateMany({
        where: { id: claimedProjectId, status: 'structuring', updatedAt: claimedAt, slides: { none: {} } },
        data: { status: 'error' },
      }).catch((error) => console.error('[doyaslide/structure] failed to release claim', error))
    }
  }
}
