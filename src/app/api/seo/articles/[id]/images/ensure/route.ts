import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, geminiGenerateJson, GEMINI_IMAGE_MODEL_DEFAULT, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { guessArticleGenreJa, pickRandomPatterns, buildBannerPromptFromPattern } from '@seo/lib/bannerPlan'
import { requireSeoImageAccess } from '@/lib/seo-image-access'
import { reserveSeoToolCalls, SeoToolRateLimitError } from '@/lib/seo-tool-admission'
import { claimSeoImageLease, releaseSeoImageLease, SeoImageGenerationInProgressError } from '@/lib/seo-image-lease'

export const runtime = 'nodejs'
export const maxDuration = 300 // 最大14枚を順次生成するため

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
 * 1クリックで「バナー(4枚候補) + 図解(最大10)」を生成（既存があれば不足分だけ生成）
 * - LIGHT以上、または初回ログイン後1時間のお試しで利用可
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireSeoImageAccess()
    if (!access.ok) return access.response
    await ensureSeoSchema()
    const userId = access.userId

    const p = await ctx.params
    const articleId = p.id
    const permitted = await (prisma as any).seoArticle.findUnique({ where: { id: articleId }, select: { userId: true } })
    if (!permitted) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (String(permitted.userId || '') !== userId) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    const leaseToken = await claimSeoImageLease(articleId)
    try {
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

    // === バナーが4枚未満なら不足分を生成 ===
    const MAX_BANNERS = 4
    const existingBanners = (article.images || []).filter((x: any) => x.kind === 'BANNER')
    const bannersToGenerate = Math.max(0, MAX_BANNERS - existingBanners.length)
    const MAX_DIAGRAMS = 10
    const existingDiagrams = (article.images || []).filter((x: any) => x.kind === 'DIAGRAM')
    const remain = Math.max(0, MAX_DIAGRAMS - existingDiagrams.length)
    if (bannersToGenerate + remain > 0) {
      await reserveSeoToolCalls(userId, 'article-images', bannersToGenerate + remain)
    }

    if (bannersToGenerate > 0) {
      // 12パターンからランダムに必要数を選択
      const selectedPatterns = pickRandomPatterns(bannersToGenerate)

      for (let bi = 0; bi < selectedPatterns.length; bi++) {
        const pattern = selectedPatterns[bi]
        try {
          const bannerPrompt = buildBannerPromptFromPattern(pattern, {
            title,
            articleText: articleTextForBanner,
            genre,
          })

          const bannerResult = await geminiGenerateImagePng({
            prompt: bannerPrompt,
            aspectRatio: '16:9',
            imageSize: '2K',
            model: GEMINI_IMAGE_MODEL_DEFAULT,
          })

          if (bannerResult?.dataBase64) {
            const filename = `seo_${articleId}_${Date.now()}_banner_${bi}.png`
            const saved = await saveBase64ToFile({ base64: bannerResult.dataBase64, filename, subdir: 'images' })

            await (prisma as any).seoImage.create({
              data: {
                articleId,
                kind: 'BANNER',
                title: `${pattern.label}スタイル`,
                description: `記事「${title}」のバナー画像（${pattern.label}）`,
                prompt: bannerPrompt,
                filePath: saved.relativePath,
                mimeType: 'image/png',
              },
            })
          }

          if (bi < selectedPatterns.length - 1) {
            await new Promise((r) => setTimeout(r, 500))
          }
        } catch (err: any) {
          console.error(`Banner ${bi + 1} (${pattern.label}) generation failed:`, err?.message)
        }
      }
    }

    // === 図解候補を提案して最大10枚生成（既にある場合は不足分のみ）===
    
    if (remain > 0) {
      const suggestPrompt = `
あなたは記事のビジュアル設計者です。
以下の記事内容を分析して、読者の理解を助ける図解（DIAGRAM）を最大${remain}個提案してください。

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

      let diagrams = Array.isArray(suggestion?.diagrams) ? suggestion.diagrams.slice(0, remain) : []

      // 提案が空でも生成が進むよう、見出しからフォールバックで図解案を作る
      if (!diagrams.length) {
        const base = headings
          .map((h: string) => String(h).replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .slice(0, remain)
        diagrams = base.map((t: string, i: number) => ({
          title: t || `図解 ${i + 1}`,
          description: `記事「${title}」の「${t}」の内容を、要点が一目で分かるように図解化してください。` +
            ` 箇条書き/フロー/比較（必要に応じて）で、アイコン・矢印・枠線を使い、白背景で余白を多めに。`,
        }))
      }
      
      if (diagrams.length) {
        const diagramTemplate = defaultDiagramTemplate()
        
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
    return NextResponse.json({ success: true, images: refreshed?.images || [] })
    } finally {
      await releaseSeoImageLease(articleId, leaseToken).catch(error => {
        console.error('[seo image ensure] lease release failed', error)
      })
    }
  } catch (e: any) {
    if (e instanceof SeoImageGenerationInProgressError) return NextResponse.json({ code: 'SEO_IMAGE_IN_PROGRESS', error: 'この記事の画像は生成中です。完了後に再読み込みしてください。' }, { status: 409 })
    if (e instanceof SeoToolRateLimitError) return NextResponse.json({ code: 'SEO_IMAGE_DAILY_LIMIT', error: `本日の追加画像生成上限（${e.limit}枚）に達しました。明日お試しください。` }, { status: 429 })
    console.error('Ensure images error:', e)
    return NextResponse.json({ success: false, error: '画像を生成できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
