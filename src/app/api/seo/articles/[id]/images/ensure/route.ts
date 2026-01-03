import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, geminiGenerateJson, GEMINI_IMAGE_MODEL_DEFAULT, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { guessArticleGenreJa, buildArticleBannerPrompt } from '@seo/lib/bannerPlan'

export const runtime = 'nodejs'
// 画像生成は外部API待ちで時間がかかるため、Vercelの関数タイムアウトを長めに確保
export const maxDuration = 300

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

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

function clampText(s: string, max: number) {
  const str = String(s || '')
  return str.length <= max ? str : str.slice(0, max)
}

function defaultDiagramTemplate() {
  return [
    'あなたは「SEO記事用の図解バナー制作」を専門とするトップクラスのデザイナーです。',
    '今回の目的は、オウンドメディアの記事内容を一瞬で理解できる',
    '"とにかく分かりやすい図解バナー画像"を制作することです。',
    '',
    '【前提】',
    '・使用用途：オウンドメディアのSEO記事内・サムネイル',
    '・ターゲット：専門知識がない人でも直感的に理解できる読者',
    '・記事内容：下記の本文内容を正確に要約・視覚化すること',
    '・難しい表現や抽象表現は使わない',
    '・「見ただけで内容が分かる」ことを最優先する',
    '',
    '【デザインの方向性】',
    '・カラー：ポップで明るい（青・水色・オレンジ・黄などをベースに）',
    '・雰囲気：親しみやすい／やさしい／説明がうまい資料のような印象',
    '・線は太め、要素は大きめ',
    '・情報量は詰め込みすぎず、整理された構成にする',
    '・背景は白 or 薄い単色で、視認性を最優先',
    '',
    '【元となる記事内容】',
    '{{ARTICLE_CONTENT}}',
  ].join('\n')
}

function applyDiagramTemplate(rawTemplate: string, vars: Record<string, string>) {
  let t = String(rawTemplate || '').trim()
  if (!t) return ''

  for (const [k, v] of Object.entries(vars)) {
    t = t.replaceAll(`{{${k}}}`, v)
  }

  return t.trim()
}

/**
 * 1クリックで「バナー + 図解(最大10)」を生成（既存があれば不足分だけ生成）
 * - 有料のみ
 */
export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const body: any = await _req.json().catch(() => ({}))
    // 1回のリクエストで生成する図解枚数（多すぎると504になりやすいので小さく）
    const diagramsPerRequest = clampInt(body?.diagramsPerRequest ?? body?.maxDiagramsPerRequest ?? body?.maxPerRequest, 1, 2, 1)
    const diagramPromptTemplate = String(body?.diagramPromptTemplate || '').trim()

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

    const title = String(article.title || '').trim()
    const articleContent = clampText(String(article.finalMarkdown || ''), 7000)
    
    // 記事本文を整形（マークダウンから不要要素を除去）
    const articleTextForBanner = String(article.finalMarkdown || '')
      .replace(/!\[[^\]]*?\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 5000)

    const headings = (String(article.finalMarkdown).match(/^#{1,3}\s+.+$/gm) || []).slice(0, 18)
    const headingsPlain = headings
      .map((h: string) => String(h).replace(/^#{1,6}\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 16)
    
    const genre = guessArticleGenreJa([title, headingsPlain.join(' '), articleContent].join(' '))

    // === バナーがなければ生成 ===
    const hasBanner = (article.images || []).some((x: any) => x.kind === 'BANNER')
    if (!hasBanner) {
      // 新しいプロンプトでバナー生成
      const bannerPrompt = buildArticleBannerPrompt({
        title,
        articleText: articleTextForBanner,
        bannerSize: '1200x628（16:9、SNS/広告向け）',
        genre,
      })

      const bannerResult = await geminiGenerateImagePng({
        prompt: bannerPrompt,
        aspectRatio: '16:9',
        imageSize: '2K',
        model: GEMINI_IMAGE_MODEL_DEFAULT,
      })

      if (bannerResult?.dataBase64) {
        const filename = `seo_${articleId}_${Date.now()}_banner.png`
        const saved = await saveBase64ToFile({ base64: bannerResult.dataBase64, filename, subdir: 'images' })

        await (prisma as any).seoImage.create({
          data: {
            articleId,
            kind: 'BANNER',
            title: '記事バナー',
            description: `記事「${title}」のバナー画像\nジャンル: ${genre}`,
            prompt: bannerPrompt,
            filePath: saved.relativePath,
            mimeType: 'image/png',
          },
        })
      }
    }

    // === 図解候補を提案して最大9枚生成（既にある場合は不足分のみ）===
    // NOTE: 504回避のため、1回のリクエストでは少数だけ生成し、クライアント側で複数回呼び出して埋める
    const MAX_DIAGRAMS = 9
    const existingDiagrams = (article.images || []).filter((x: any) => x.kind === 'DIAGRAM')
    const remain = Math.max(0, MAX_DIAGRAMS - existingDiagrams.length)
    
    if (remain > 0) {
      const want = Math.max(1, Math.min(remain, diagramsPerRequest))
      const suggestPrompt = `
あなたは記事のビジュアル設計者です。
以下の記事内容を分析して、読者の理解を助ける図解（DIAGRAM）を最大${want}個提案してください。

タイトル: ${title}
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

      let diagrams = Array.isArray(suggestion?.diagrams) ? suggestion.diagrams.slice(0, want) : []

      // 提案が空でも生成が進むよう、見出しからフォールバックで図解案を作る
      if (!diagrams.length) {
        const base = headings
          .map((h: string) => String(h).replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .slice(0, want)
        diagrams = base.map((t: string, i: number) => ({
          title: t || `図解 ${i + 1}`,
          description: `記事「${title}」の「${t}」の内容を、要点が一目で分かるように図解化してください。` +
            ` 箇条書き/フロー/比較（必要に応じて）で、アイコン・矢印・枠線を使い、白背景で余白を多めに。`,
        }))
      }
      
      if (diagrams.length) {
        const diagramTemplate = diagramPromptTemplate ? diagramPromptTemplate : defaultDiagramTemplate()
        
        for (const diagram of diagrams) {
          const prompt = [
            applyDiagramTemplate(diagramTemplate, {
              ARTICLE_CONTENT: articleContent,
              DIAGRAM_TITLE: String(diagram.title || ''),
              DIAGRAM_DESCRIPTION: String(diagram.description || ''),
            }),
            '',
            '【この図解で伝えるメッセージ（1つに絞る）】',
            String(diagram.title || '').trim(),
            String(diagram.description || '').trim() ? `補足: ${String(diagram.description || '').trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n')

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
    const imgs = (refreshed?.images || []) as any[]
    const hasBanner2 = imgs.some((x) => String(x?.kind || '').toUpperCase() === 'BANNER')
    const diagCount2 = imgs.filter((x) => String(x?.kind || '').toUpperCase() === 'DIAGRAM').length
    const remainingDiagrams = Math.max(0, 9 - diagCount2)
    return NextResponse.json({
      success: true,
      images: imgs,
      hasBanner: hasBanner2,
      diagramCount: diagCount2,
      remainingDiagrams,
      diagramsPerRequest,
    })
  } catch (e: any) {
    console.error('Ensure images error:', e)
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}
