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
      `あなたは法人検索のエキスパートです。ユーザーが入力したキーワードを、`,
      `日本の法人名に含まれる可能性が高い検索ワード（漢字・カタカナ）に展開してください。`,
      ``,
      `■ ユーザー入力: ${userInput}`,
      industry ? `■ 業界: ${industry}` : '',
      ``,
      `要件:`,
      `- 5〜8個の検索ワードを提案`,
      `- 法人名に実際に含まれる漢字・カタカナ語を優先（例: 「SaaS」→「ソフトウェア」「システム」「テクノロジー」）`,
      `- 抽象語より具体語（例: 「営業」→「セールス」「アポイント」「マーケティング」より「セールス」「営業」「商事」）`,
      `- 業界に紐づく代表企業名要素も含める`,
      `- 1単語あたり2〜10文字`,
      ``,
      `出力形式（JSON）:`,
      `{ "tags": ["タグ1", "タグ2", "タグ3", ...] }`,
      ``,
      `例:`,
      `- 入力「SaaS」業界「IT・ソフトウェア」 → ["クラウド","ソフトウェア","システム","テクノロジー","プラットフォーム","ネットワーク"]`,
      `- 入力「営業効率化」業界「IT・ソフトウェア」 → ["セールス","CRM","マーケティング","コンサルティング","ソリューション"]`,
      `- 入力「美容」業界「小売・EC」 → ["コスメ","ビューティ","エステ","スキンケア","美容"]`,
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
