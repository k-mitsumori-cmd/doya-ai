export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

/**
 * POST /api/doyalist/expand-keywords
 * ユーザー入力キーワードをgBizINFO検索向けの法人名キーワードに展開
 * Body: { keyword: string, industry?: string }
 * Response: { tags: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { keyword, industry } = body || {}

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json({ error: 'キーワードを入力してください' }, { status: 400 })
    }

    const userInput = keyword.trim().slice(0, 100)

    const prompt = [
      `あなたは日本の法人検索のエキスパートです。ユーザーが入力したキーワードを、`,
      `日本の法人名に実際に含まれる「自然で簡潔な日本語の検索ワード」に展開してください。`,
      ``,
      `■ ユーザー入力: ${userInput}`,
      industry ? `■ 業界: ${industry}` : '',
      ``,
      `要件:`,
      `- 5〜8個の検索ワードを提案`,
      `- **日本語として自然で簡潔な表現を優先**`,
      `  ✓ 良い例: 「デジタライズ」「デジタル」「IT」`,
      `  ✗ 悪い例: 「デジタライゼーション」「デジタルトランスフォーメーション」（長すぎて法人名に含まれにくい）`,
      `- 法人名に実際によく含まれる漢字・カタカナを優先`,
      `- 1単語あたり 2〜8文字（短い方がヒット率高い）`,
      `- 業界に関連する代表的な単語も含める`,
      `- カタカナ語の場合、省略形を優先（例: ×システムソリューション → ◯システム + ソリューション）`,
      ``,
      `出力形式（JSON）:`,
      `{ "tags": ["タグ1", "タグ2", "タグ3", ...] }`,
      ``,
      `例:`,
      `- 入力「SaaS」業界「IT・ソフトウェア」 → ["クラウド","ソフトウェア","システム","テック","アプリ"]`,
      `- 入力「営業効率化」業界「IT・ソフトウェア」 → ["セールス","営業","マーケ","CRM","ソリューション"]`,
      `- 入力「美容」業界「小売・EC」 → ["コスメ","ビューティ","エステ","美容","スキンケア"]`,
      `- 入力「DX」業界「IT・ソフトウェア」 → ["デジタル","デジタライズ","IT","システム","テック"]`,
      `- 入力「人材」業界「人材」 → ["人材","リクルート","スタッフ","キャリア","採用"]`,
    ].filter(Boolean).join('\n')

    let result: { tags?: string[] }
    try {
      result = await geminiGenerateJson<{ tags?: string[] }>({
        prompt,
        model: GEMINI_TEXT_MODEL_DEFAULT,
      })
    } catch (e: any) {
      console.error('[doyalist/expand-keywords] gemini error', e)
      return NextResponse.json({ error: 'AI変換に失敗しました' }, { status: 502 })
    }

    const tags = Array.isArray(result?.tags)
      ? result.tags.filter((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 20).slice(0, 8)
      : []

    if (tags.length === 0) {
      return NextResponse.json({ error: '有効なタグを生成できませんでした' }, { status: 502 })
    }

    return NextResponse.json({ success: true, tags })
  } catch (e: any) {
    console.error('[doyalist/expand-keywords]', e)
    return NextResponse.json({ error: e?.message || 'タグ展開に失敗しました' }, { status: 500 })
  }
}
