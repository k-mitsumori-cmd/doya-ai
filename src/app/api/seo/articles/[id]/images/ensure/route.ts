import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateImagePng, geminiGenerateJson, GEMINI_IMAGE_MODEL_DEFAULT, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { formatBannerPlanDescription, generateArticleBannerPlan, guessArticleGenreJa, mapGenreToNanobannerCategory } from '@seo/lib/bannerPlan'
import { generateBanners } from '@/lib/nanobanner'
import { z } from 'zod'

export const runtime = 'nodejs'

type PlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

const BodySchema = z
  .object({
    bannerPromptTemplate: z.string().max(50_000).optional(),
    diagramPromptTemplate: z.string().max(50_000).optional(),
  })
  .optional()

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

function stripNoTextStatements(raw: string): string {
  const s = String(raw || '')
  if (!s) return s
  // 「文字を入れない」系が混入しても生成側から除去（ドヤライティングAIのみ）
  const lines = s.replace(/\r\n/g, '\n').split('\n')
  const filtered = lines.filter((line) => {
    const t = line.trim()
    if (!t) return true
    if (t.includes('画像に文字は入れない')) return false
    if (t.includes('画像内に文字') && t.includes('入れない')) return false
    if (t.includes('後から文字を載せられる')) return false
    if (t.includes('ネガティブスペース')) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function applyTemplate(rawTemplate: string, vars: Record<string, string>) {
  let t = stripNoTextStatements(String(rawTemplate || '')).trim()
  if (!t) return ''

  // ユーザーが貼るテンプレに多いプレースホルダ（そのまま置換）
  for (const [k, v] of Object.entries(vars)) {
    t = t.replaceAll(`{{${k}}}`, v)
  }

  // 「▼ここに…▼」のようなダミー行があれば記事本文に差し替える
  if (/▼ここに/.test(t)) {
    t = t.replace(/▼ここに[\s\S]*?▼/g, vars.ARTICLE_TEXT || vars.ARTICLE_CONTENT || '')
  }

  return t.trim()
}

function defaultBannerTemplate() {
  return `あなたは成果の出る広告バナーを専門に制作する一流のマーケティングデザイナーです。
以下の「記事本文テキスト」を読み取り、内容を要約・再構成し、
クリック率・視認性・訴求力を最大化する広告バナー画像を生成してください。

【前提条件】
・バナー用途：Web広告 / 記事内バナー / SNS広告
・ターゲット：記事内容から最も適切なペルソナを自動推定する
・目的：一瞬で価値が伝わり「詳しく見たい」と思わせること

【必須ルール】
・画像内に使用するテキストは、必ず記事本文の内容を基に生成する
・誇張しすぎず、ただし広告として弱くならない表現にする
・文字は必ず読みやすく、背景と十分なコントラストを確保する
・日本の広告バナーでよく使われる構成・トーンを踏襲する

【バナーデザイン構成】
1. メインキャッチ（最も伝えたい価値を短く・強く）
2. サブコピー（安心感・具体性・実績・限定性など）
3. 補足要素（実績数値／価格／割引／特徴／権威性など）
4. CTA文言（例：「詳しくはこちら」「今すぐチェック」など）

【ビジュアル指針】
・人物が適切な場合：日本人モデル、自然な表情、広告感のある構図
・商品が主役の場合：清潔感・高級感・信頼感を重視
・教育／ビジネス系：青・紫・黒系を基調に信頼感を演出
・美容／EC系：白・ベージュ・淡色を基調に上品さを演出
・セール／キャンペーン系：赤・オレンジ・黄色で緊急性を演出

【禁止事項】
・意味のない装飾
・読みづらい極小文字
・記事内容と乖離したコピー
・英語の多用（日本向け広告のため）

【入力】
▼ 記事本文テキスト：
{{ARTICLE_TEXT}}

【出力】
・1枚の完成された広告バナー画像
・視認性が高く、広告として即利用可能なクオリティ`
}

function defaultDiagramTemplate() {
  return [
    'あなたは「SEO記事用の図解バナー制作」を専門とするトップクラスのデザイナーです。',
    '今回の目的は、オウンドメディアの記事内容を一瞬で理解できる',
    '“とにかく分かりやすい図解バナー画像”を制作することです。',
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

/**
 * 1クリックで「バナー + 図解(最大10)」を生成（既存があれば不足分だけ生成）
 * - 有料のみ
 * - 既存API(/images/banner, /images/batch)を内部で呼ぶのではなく、同等処理をここで行う
 */
export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const body = BodySchema ? BodySchema.parse(await _req.json().catch(() => undefined)) : undefined
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

    const articleContent = clampText(String(article.finalMarkdown || ''), 7000)
    const headings = (String(article.finalMarkdown).match(/^#{1,3}\s+.+$/gm) || []).slice(0, 18)
    const headingsPlain = headings
      .map((h: string) => String(h).replace(/^#{1,6}\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 16)
    const genreGuess = guessArticleGenreJa([String(article.title || ''), headingsPlain.join(' '), articleContent].join(' '))
    const varsBase = {
      ARTICLE_TITLE: String(article.title || ''),
      KEYWORDS: String(((article.keywords as any) || []).join(', ')),
      HEADINGS: headings.join(' / '),
      ARTICLE_CONTENT: articleContent,
      ARTICLE_TEXT: articleContent,
      GENRE: genreGuess,
      USAGE: '記事一覧/SNS（記事アイキャッチ）',
    }

    const bannerTemplate = String(body?.bannerPromptTemplate || '').trim() || defaultBannerTemplate()
    const diagramTemplate = String(body?.diagramPromptTemplate || '').trim() || defaultDiagramTemplate()

    // バナーがなければ生成
    const hasBanner = (article.images || []).some((x: any) => x.kind === 'BANNER')
    if (!hasBanner) {
      const category = mapGenreToNanobannerCategory(genreGuess)
      const filledPrompt = applyTemplate(bannerTemplate, varsBase)

      const result = await generateBanners(
        category,
        String(article.title || '').trim(),
        '1200x628',
        {
          purpose: 'sns_ad',
          customImagePrompt: filledPrompt,
        },
        1
      )
      const dataUrl = Array.isArray(result?.banners) ? result.banners.find((b) => typeof b === 'string' && b.startsWith('data:image/')) : null
      if (!dataUrl) throw new Error(result?.error || 'バナー画像の生成に失敗しました')
      const base64 = String(dataUrl).split(',')[1] || ''

      const filename = `seo_${articleId}_${Date.now()}_banner.png`
      const saved = await saveBase64ToFile({ base64, filename, subdir: 'images' })

      // 保存用のプロンプトログ（表示用）
      const promptLog = filledPrompt

      await (prisma as any).seoImage.create({
        data: {
          articleId,
          kind: 'BANNER',
          title: '記事バナー',
          prompt: promptLog,
          filePath: saved.relativePath,
          mimeType: 'image/png',
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
            applyTemplate(diagramTemplate, {
              ...varsBase,
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
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


