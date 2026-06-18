// ============================================
// ドヤAIO クイックスタート補助
// 「サービスURL＋サービス名」だけから、AIで①カテゴリ ②監視プロンプト案 を生成する。
// 組織作成を意識させない“即・現状チェック”フローで使う。
// 失敗時は名前ベースの汎用プロンプトにフォールバックする（必ず何か返す）。
// ============================================
import { geminiGenerateJson } from '@seo/lib/gemini'

export interface BrandSetupSuggestion {
  category: string | null
  prompts: string[]
}

// LLM失敗時の汎用フォールバック（サービス名を差し込むだけ。固有の他社名は出さない）
function fallbackPrompts(brandName: string): string[] {
  const n = brandName.trim() || 'このサービス'
  return [
    `${n}のようなサービスでおすすめはどれ？`,
    `${n}と似たサービスを比較したい。主な選択肢を教えて`,
    `初心者・中小企業向けに${n}の分野でおすすめは？`,
    `${n}の分野で人気・定番のサービスは？`,
    `${n}の分野で信頼できるサービスはどれ？`,
  ]
}

/**
 * サービス名＋URLから、AI可視性を測るための監視プロンプトとカテゴリを生成する。
 * - prompts: 一般ユーザーがAIに尋ねそうな「このサービスが登場しうる質問」。固有ブランド名は含めず汎用的に。
 * - category: 推定カテゴリ（例: マーケティングAI SaaS）。
 */
export async function suggestBrandSetup(input: { brandName: string; url?: string | null }): Promise<BrandSetupSuggestion> {
  const brandName = (input.brandName || '').trim()
  const url = (input.url || '').trim()
  if (!brandName) return { category: null, prompts: [] }

  const prompt = `あなたはAEO（AI可視性最適化）の専門家です。あるサービスについて、生成AI（ChatGPT等）での露出を測定するための「監視プロンプト」を作ります。

# 対象サービス
名称: ${brandName}
URL: ${url || '(未入力)'}

# やること
1. このサービスのカテゴリを推定する（例:「マーケティングAI SaaS」「会計クラウド」など簡潔に）。
2. 一般ユーザーが生成AIに尋ねたときに、このサービスが“おすすめ候補として登場しうる”自然な日本語の質問を5つ作る。

# 厳守ルール
- 質問文に固有のブランド名・企業名（対象サービス名も他社名も）を含めない。あくまで「カテゴリの一般的な相談」にする。
- 「おすすめは？」「比較したい」「初心者向けは？」など、実際に検索代わりにAIへ尋ねる体裁にする。
- 出力は次のJSONのみ: {"category": string, "prompts": string[5]}`

  try {
    const r = await geminiGenerateJson<{ category?: string; prompts?: string[] }>({ prompt } as any)
    const prompts = Array.isArray(r?.prompts)
      ? r!.prompts!.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 5)
      : []
    return {
      category: (typeof r?.category === 'string' && r.category.trim()) ? r.category.trim().slice(0, 120) : null,
      prompts: prompts.length ? prompts : fallbackPrompts(brandName),
    }
  } catch {
    return { category: null, prompts: fallbackPrompts(brandName) }
  }
}
