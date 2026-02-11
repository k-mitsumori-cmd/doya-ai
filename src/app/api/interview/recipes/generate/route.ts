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

    const body = await req.json()
    const sampleTexts: string[] = body.sampleTexts || []
    const recipeName: string = body.name || ''
    const category: string = body.category || 'custom'

    if (sampleTexts.length === 0 || !sampleTexts[0]?.trim()) {
      return NextResponse.json(
        { success: false, error: 'サンプル記事を1つ以上入力してください' },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const samplesText = sampleTexts
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
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
      return NextResponse.json(
        { success: false, error: 'レシピの解析に失敗しました' },
        { status: 500 }
      )
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'レシピの生成に失敗しました' },
        { status: 500 }
      )
    }

    // autoSave が指定されていれば DB に保存
    if (body.autoSave) {
      const recipe = await prisma.interviewRecipe.create({
        data: {
          userId,
          name: (recipeName || result.name || '自動生成レシピ').trim(),
          description: result.description || null,
          category: category || result.category || 'custom',
          editingGuidelines: result.editingGuidelines || null,
          proposals: result.structure || [],
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
        category: result.category,
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
      { success: false, error: e?.message || 'レシピ自動生成に失敗しました' },
      { status: 500 }
    )
  }
}