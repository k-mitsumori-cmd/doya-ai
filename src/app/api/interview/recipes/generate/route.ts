// ============================================
// POST /api/interview/recipes/generate
// ============================================
// サンプル記事からレシピ(構成テンプレート)を自動生成
// 記事のテキストを解析して構成パターンを抽出し、
// 再利用可能なレシピとして保存

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, requireDatabase } from '@/lib/interview/access'
import { generateInterviewContent, InterviewGeminiError } from '@/lib/interview/gemini-request'

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

function getModel(): string {
  return process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), 100000) : null
}

function parseGeneratedRecipe(value: unknown) {
  const source = asRecord(value)
  if (!source) return null
  const structure = (Array.isArray(source.structure) ? source.structure : [])
    .slice(0, 30)
    .flatMap((entry: unknown) => {
      const row = asRecord(entry)
      const section = safeText(row?.section, 200)
      if (!section) return []
      return [{
        section,
        description: safeText(row?.description, 1000),
        wordCount: positiveInt(row?.wordCount),
      }]
    })
  const recipe = {
    name: safeText(source.name, 200),
    description: safeText(source.description, 2000),
    editingGuidelines: safeText(source.editingGuidelines, 20000),
    structure,
    detectedFormat: source.detectedFormat === 'QA' || source.detectedFormat === 'MONOLOGUE'
      ? source.detectedFormat : null,
    styleNotes: safeText(source.styleNotes, 2000),
    estimatedWordCount: positiveInt(source.estimatedWordCount),
  }
  return recipe.editingGuidelines || recipe.structure.length ? recipe : null
}

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId } = await getInterviewUser()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'レシピ自動生成にはログインが必要です' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Array.isArray(body.sampleTexts) || body.sampleTexts.length === 0
      || body.sampleTexts.length > 3 || body.sampleTexts.some((text: unknown) => typeof text !== 'string')
      || (body.name != null && (typeof body.name !== 'string' || body.name.length > 200))
      || (body.category != null && (typeof body.category !== 'string' || body.category.length > 80))
      || (body.autoSave != null && typeof body.autoSave !== 'boolean')) {
      return NextResponse.json(
        { success: false, error: '入力形式を確認してください' },
        { status: 400 }
      )
    }
    const sampleTexts: string[] = body.sampleTexts
    const recipeName: string = body.name || ''
    const category: string = body.category || 'custom'

    if (!sampleTexts.some((text) => text.trim())) {
      return NextResponse.json(
        { success: false, error: 'サンプル記事を1つ以上入力してください' },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()

    const samplesText = sampleTexts.filter((text) => text.trim())
      .slice(0, 3) // 最大3記事
      .map((text, i) => `=== サンプル記事 ${i + 1} ===\n${text.slice(0, 15000)}`)
      .join('\n\n')

    const prompt = `あなたは記事構成の専門家です。以下のサンプル記事を分析して、再利用可能な記事テンプレート（レシピ）を作成してください。

【分析ポイント】
1. 記事全体の構造パターン（セクション構成）
2. 見出しの階層と命名パターン
3. 文章のトーン・文体
4. インタビュー形式（Q&A / ストーリー / 対談）
5. リード文のパターン
6. まとめ・CTAのパターン
7. 文字数の目安
8. 使用されている修辞技法

【出力形式】
以下のJSON形式のみ出力してください。

{
  "name": "レシピ名（自動命名）",
  "description": "このレシピの概要説明（1〜2文）",
  "category": "interview",
  "detectedFormat": "MONOLOGUE または QA",
  "editingGuidelines": "# 構成ガイドライン\\n\\n## 1. リード文\\n- ...\\n\\n## 2. 本文構成\\n- ...\\n\\n## 3. 文体・トーン\\n- ...\\n\\n## 4. まとめ\\n- ...",
  "structure": [
    { "section": "リード文", "description": "記事の冒頭、読者を引き込む導入", "wordCount": 200 },
    { "section": "背景紹介", "description": "取材対象や企業の紹介", "wordCount": 300 }
  ],
  "styleNotes": "文体の特徴メモ",
  "estimatedWordCount": 3000
}

category は以下のいずれか: interview, panel, pr, news, column, case_study, event, profile, summary, custom

${samplesText}`

    const geminiData = await generateInterviewContent(apiKey, model, prompt, {
      temperature: 0.3, maxOutputTokens: 8192,
    }, 110_000)
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    let parsedResult: unknown
    try {
      const jsonMatch = typeof rawText === 'string' ? rawText.match(/\{[\s\S]*\}/) : null
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      return NextResponse.json(
        { success: false, error: 'レシピの解析に失敗しました' },
        { status: 500 }
      )
    }

    const result = parseGeneratedRecipe(parsedResult)
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'レシピの生成結果を読み取れませんでした。再度お試しください。' },
        { status: 502 }
      )
    }

    // autoSave が指定されていれば DB に保存
    if (body.autoSave) {
      const recipe = await prisma.interviewRecipe.create({
        data: {
          userId,
          name: (recipeName || result.name || '自動生成レシピ').trim(),
          description: result.description || null,
          category,
          editingGuidelines: result.editingGuidelines || null,
          proposals: result.structure,
          questions: [],
          isPublic: false,
          isTemplate: false,
        },
      })

      return NextResponse.json({
        success: true,
        saved: true,
        recipeId: recipe.id,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          description: result.description,
          category: recipe.category,
          editingGuidelines: result.editingGuidelines,
          structure: result.structure,
          detectedFormat: result.detectedFormat,
          styleNotes: result.styleNotes,
          estimatedWordCount: result.estimatedWordCount,
        },
      })
    }

    // プレビューのみ
    return NextResponse.json({
      success: true,
      saved: false,
      recipe: {
        name: recipeName || result.name || '自動生成レシピ',
        description: result.description,
        category,
        editingGuidelines: result.editingGuidelines,
        structure: result.structure,
        detectedFormat: result.detectedFormat,
        styleNotes: result.styleNotes,
        estimatedWordCount: result.estimatedWordCount,
      },
    })
  } catch (e: any) {
    console.error('[interview] recipe-generate error:', e?.message)
    return NextResponse.json(
      { success: false, error: e instanceof InterviewGeminiError ? e.message : 'レシピ自動生成に失敗しました' },
      { status: e instanceof InterviewGeminiError ? 503 : 500 }
    )
  }
}
