// ============================================
// ドヤ広告バナーAI AI自動フィードバック（Gemini）
// 観点別採点＋改善提案。プロンプト・メタ情報ベースで評価（広告特化）。
// ============================================
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { BannerFeedback, AdMedia } from './types'
import { MEDIA_LABEL } from './types'

export interface FeedbackInput {
  serviceName: string
  appeal?: string
  media: AdMedia
  size: string
  variantLabel?: string
  prompt: string
  brandColors?: string[]
}

const clamp = (n: any) => (typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0)

export async function generateFeedback(i: FeedbackInput): Promise<BannerFeedback> {
  const prompt = [
    'あなたは広告クリエイティブのレビュー専門家です。次の広告バナーの設計内容を、広告として成果が出るかの観点で採点してください。',
    '（画像の設計指示＝プロンプトと条件から評価します）',
    '',
    `商材: ${i.serviceName}`,
    i.appeal ? `訴求: ${i.appeal}` : '',
    `媒体: ${MEDIA_LABEL[i.media]} / サイズ: ${i.size} / バリエーション: ${i.variantLabel || '-'}`,
    i.brandColors?.length ? `ブランドカラー: ${i.brandColors.join(', ')}` : '',
    '',
    '設計指示(プロンプト):',
    i.prompt.slice(0, 1500),
    '',
    '各観点を0〜100で採点し、総合(total)と「次にこう直すと良い」改善提案(advice 2〜3文)を返す。',
    '次のJSONのみ（日本語・コードフェンス禁止）:',
    '{ "visibility": 数値, "appeal": 数値, "cta": 数値, "fit": 数値, "brand": 数値, "total": 数値, "advice": "改善提案" }',
  ].filter(Boolean).join('\n')

  const r = await geminiGenerateJson<BannerFeedback>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AdBannerFeedback')
  const visibility = clamp(r?.visibility), appeal = clamp(r?.appeal), cta = clamp(r?.cta), fit = clamp(r?.fit), brand = clamp(r?.brand)
  const total = r?.total != null ? clamp(r.total) : Math.round((visibility + appeal + cta + fit + brand) / 5)
  return { visibility, appeal, cta, fit, brand, total, advice: r?.advice || '' }
}
