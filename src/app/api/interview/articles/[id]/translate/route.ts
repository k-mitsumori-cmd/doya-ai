// ============================================
// POST /api/interview/articles/[id]/translate
// ============================================
// 記事の多言語翻訳 — Markdown構造を保持しつつ翻訳

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

function getModel(): string {
  return process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash'
}

const LANGUAGE_CONFIG: Record<string, { name: string; nativeName: string; guide: string }> = {
  en: {
    name: 'English',
    nativeName: 'English',
    guide: 'Use natural, professional English. Maintain AP style for news-like content.',
  },
  zh: {
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    guide: '使用自然流畅的简体中文。保持专业但易读的风格。',
  },
  'zh-tw': {
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    guide: '使用自然流暢的繁體中文。保持專業但易讀的風格。',
  },
  ko: {
    name: 'Korean',
    nativeName: '한국어',
    guide: '자연스러운 한국어를 사용하세요. 전문적이지만 읽기 쉬운 스타일을 유지하세요.',
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    guide: 'Use natural, professional Spanish. Prefer neutral Latin American Spanish.',
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    guide: 'Use natural, professional French. Follow standard French grammar rules.',
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    guide: 'Use natural, professional German. Follow standard German conventions.',
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    guide: 'Use natural Brazilian Portuguese. Maintain professional tone.',
  },
  vi: {
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    guide: 'Use natural Vietnamese. Maintain professional but accessible tone.',
  },
  th: {
    name: 'Thai',
    nativeName: 'ภาษาไทย',
    guide: 'Use natural Thai. Maintain professional but accessible tone.',
  },
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const draftId = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const draft = await prisma.interviewDraft.findUnique({
      where: { id: draftId },
      include: {
        project: {
          select: {
            id: true, userId: true, guestId: true, title: true,
            intervieweeName: true, intervieweeCompany: true,
          },
        },
      },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    if (!draft.content || draft.content.length < 50) {
      return NextResponse.json(
        { success: false, error: '翻訳するには記事が短すぎます' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const targetLang: string = body.language || 'en'
    const langConfig = LANGUAGE_CONFIG[targetLang]

    if (!langConfig) {
      return NextResponse.json(
        { success: false, error: `未対応の言語です: ${targetLang}。対応言語: ${Object.keys(LANGUAGE_CONFIG).join(', ')}` },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const prompt = `You are a professional translator specializing in media and interview content.
Translate the following Japanese article into ${langConfig.name} (${langConfig.nativeName}).

【Translation Guidelines】
1. Preserve all Markdown formatting (headings, bold, blockquotes, lists, etc.)
2. Maintain the tone and nuance of the original
3. Adapt cultural references where necessary for the target audience
4. Keep proper nouns (company names, product names) in their original or commonly-used form
5. Translate the title as well
6. ${langConfig.guide}

【Important Rules】
- Do NOT add translator notes or explanations
- Do NOT omit any content
- Do NOT change the structure or order of the article
- Keep interview quotes natural in the target language
- Person name: ${draft.project.intervieweeName || '(not specified)'}
- Company: ${draft.project.intervieweeCompany || '(not specified)'}

【Output Format】
Output ONLY the JSON below. No other text.

{
  "title": "Translated title",
  "content": "Full translated article in Markdown",
  "seoTitle": "SEO-optimized title in target language (50-60 chars)",
  "seoDescription": "SEO meta description in target language (120-155 chars)"
}

====== 翻訳元記事 ======
タイトル: ${draft.title || draft.project.title}

${draft.content.slice(0, 60000)}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API エラー (${res.status}): ${errText.slice(0, 200)}`)
    }

    const geminiData = await res.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let result: any
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      result = null
    }

    if (!result || !result.content) {
      // JSONパース失敗の場合、テキスト全体を翻訳結果として使用
      return NextResponse.json({
        success: true,
        language: targetLang,
        languageName: langConfig.name,
        title: draft.title || '',
        content: rawText,
        seoTitle: '',
        seoDescription: '',
        wordCount: rawText.length,
      })
    }

    return NextResponse.json({
      success: true,
      language: targetLang,
      languageName: langConfig.name,
      title: result.title || '',
      content: result.content || '',
      seoTitle: result.seoTitle || '',
      seoDescription: result.seoDescription || '',
      wordCount: (result.content || '').length,
    })
  } catch (e: any) {
    console.error('[interview] translate error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || '翻訳に失敗しました' },
      { status: 500 }
    )
  }
}
