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
import type { SlideStructure } from '@/lib/doyaslide/types'

// POST /api/doyaslide/structure — 資料タイプのひな型でスライド構成を生成
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { projectId, referenceText, referenceUrl } = body
    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await prisma.doyaSlideProject.findFirst({ where: { id: projectId, userId } })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    await prisma.doyaSlideProject.update({ where: { id: projectId }, data: { status: 'structuring' } })

    // 参考URLがあれば内容を取得して参考情報に加える（失敗しても構成生成は続行）
    let ref = (referenceText as string) || ''
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
      await prisma.doyaSlideProject.update({ where: { id: projectId }, data: { status: 'error' } })
      return NextResponse.json({ error: '構成の生成に失敗しました。もう一度お試しください。' }, { status: 502 })
    }

    // 既存スライドを置き換え
    await prisma.doyaSlideSlide.deleteMany({ where: { projectId } })
    await prisma.$transaction(
      slides.map((s, i) =>
        prisma.doyaSlideSlide.create({
          data: {
            projectId,
            index: i + 1,
            role: s.role || null,
            headline: s.headline || null,
            subText: s.subText || null,
            visualPrompt: s.visualPrompt || s.headline || project.title,
            status: 'pending',
          },
        })
      )
    )

    const created = await prisma.doyaSlideSlide.findMany({ where: { projectId }, orderBy: { index: 'asc' } })
    return NextResponse.json({ slides: created })
  } catch (e: any) {
    console.error('[doyaslide/structure]', e?.stack || e?.message)
    const detail = typeof e?.message === 'string' ? e.message : JSON.stringify(e)
    return NextResponse.json({ error: `構成の生成に失敗しました: ${detail || 'unknown'}`.slice(0, 400) }, { status: 500 })
  }
}
