import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, geminiGenerateJson, GEMINI_IMAGE_MODEL_DEFAULT, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'

export const runtime = 'nodejs'

type PlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  if (s === 'GUEST') return 'GUEST'
  return 'UNKNOWN'
}

function isPaid(plan: PlanCode) {
  return plan === 'PRO' || plan === 'ENTERPRISE'
}

/**
 * 1クリックで「バナー + 図解(最大10)」を生成（既存があれば不足分だけ生成）
 * - 有料のみ
 * - 既存API(/images/banner, /images/batch)を内部で呼ぶのではなく、同等処理をここで行う
 */
export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '')
    const plan = normalizePlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }
    if (!isPaid(plan)) {
      return NextResponse.json({ success: false, error: '画像生成は有料プラン限定です' }, { status: 403 })
    }

    const articleId = ctx.params.id
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: articleId },
      include: { images: { orderBy: { createdAt: 'desc' } } },
    })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (String(article.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }
    if (!article.finalMarkdown) {
      return NextResponse.json({ success: false, error: '本文がありません（先に記事生成を完了してください）' }, { status: 400 })
    }

    await ensureSeoStorage()

    // バナーがなければ生成
    const hasBanner = (article.images || []).some((x: any) => x.kind === 'BANNER')
    if (!hasBanner) {
      const prompt = [
        'Create a modern Japanese SEO article banner image.',
        'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
        'Create a clean visual with a large empty area for text overlay.',
        'Style: professional, high contrast, modern.',
        '',
        `Theme: ${article.title}`,
        `Keywords: ${((article.keywords as any) || []).join(', ')}`,
        '',
        'Output: a single 16:9 banner image.',
      ].join('\n')

      const img = await geminiGenerateImagePng({
        prompt,
        aspectRatio: '16:9',
        imageSize: '2K',
        model: GEMINI_IMAGE_MODEL_DEFAULT,
      })

      const filename = `seo_${articleId}_${Date.now()}_banner.png`
      const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

      await (prisma as any).seoImage.create({
        data: {
          articleId,
          kind: 'BANNER',
          title: '記事バナー',
          prompt,
          filePath: saved.relativePath,
          mimeType: img.mimeType || 'image/png',
        },
      })
    }

    // 図解候補を提案して最大10枚生成（既にある場合は不足分のみ）
    // 合計最大10枚（バナー1枚 + 図解最大9枚）
    const MAX_TOTAL = 10
    const existingDiagrams = (article.images || []).filter((x: any) => x.kind === 'DIAGRAM')
    const maxDiagrams = hasBanner ? (MAX_TOTAL - 1) : (MAX_TOTAL - 1) // バナーが無い場合はこの後作るので図解は常に最大9
    const remain = Math.max(0, maxDiagrams - existingDiagrams.length)
    if (remain > 0) {
      const headings = String(article.finalMarkdown).match(/^#{1,3}\s+.+$/gm) || []
      const suggestPrompt = `
あなたは記事のビジュアル設計者です。
以下の記事内容を分析して、読者の理解を助ける図解（DIAGRAM）を最大${remain}個提案してください。

タイトル: ${article.title}
見出し: ${headings.slice(0, 15).join(' / ')}
本文抜粋: ${String(article.finalMarkdown).slice(0, 3500)}

出力形式（JSONのみ）:
{"diagrams": [{"title": "図解タイトル", "description": "図解の内容説明（Geminiが画像生成できるよう詳細に）"}]}
      `
      const suggestion = await geminiGenerateJson<{ diagrams?: { title: string; description: string }[] }>({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt: suggestPrompt,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }).catch(() => ({ diagrams: [] }))

      let diagrams = Array.isArray(suggestion?.diagrams) ? suggestion.diagrams.slice(0, remain) : []

      // 提案が空でも生成が進むよう、見出しからフォールバックで図解案を作る
      if (!diagrams.length) {
        const base = headings
          .map((h: string) => String(h).replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .slice(0, remain)
        diagrams = base.map((t: string, i: number) => ({
          title: t || `図解 ${i + 1}`,
          description: `記事「${article.title}」の「${t}」の内容を、要点が一目で分かるように図解化してください。` +
            ` 箇条書き/フロー/比較（必要に応じて）で、アイコン・矢印・枠線を使い、白背景で余白を多めに。`,
        }))
      }
      if (diagrams.length) {
        for (const diagram of diagrams) {
          const prompt = [
            'Create a clean monochrome-friendly diagram illustration for a Japanese business article.',
            'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
            'Use simple shapes, icons, arrows, and layout to represent the concept.',
            'Style: flat vector-like, minimal, high contrast, plenty of whitespace.',
            '',
            `Article title: ${article.title}`,
            `Diagram title (concept): ${diagram.title}`,
            `What to express: ${diagram.description}`,
            '',
            'Output: one square (1:1) diagram image.',
          ].join('\n')

          const img = await geminiGenerateImagePng({
            prompt,
            aspectRatio: '1:1',
            imageSize: '2K',
            model: GEMINI_IMAGE_MODEL_DEFAULT,
          })

          const filename = `seo_${articleId}_${Date.now()}_diagram.png`
          const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

          await (prisma as any).seoImage.create({
            data: {
              articleId,
              kind: 'DIAGRAM',
              title: diagram.title,
              description: diagram.description,
              prompt,
              filePath: saved.relativePath,
              mimeType: img.mimeType || 'image/png',
            },
          })

          await new Promise((r) => setTimeout(r, 500))
        }
      }
    }

    // 最新を返す
    const refreshed = await (prisma as any).seoArticle.findUnique({
      where: { id: articleId },
      include: { images: { orderBy: { createdAt: 'desc' } } },
    })
    return NextResponse.json({ success: true, images: refreshed?.images || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


