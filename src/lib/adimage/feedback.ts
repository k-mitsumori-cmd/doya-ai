// ============================================
// ドヤ広告画像AI フィードバック（実画像を見て採点する）
// ============================================
// ⚠️ ここが前身 /adbanner との決定的な差。
//    adbanner の feedback.ts はプロンプト文字列だけを Gemini に渡しており、
//    「視認性（文字の可読性）」を採点しているのに実際の画像を一度も見ていなかった。
//    文字が崩れていても高得点が出るため、改善ループの土台が機能していなかった。
//    本サービスは必ず画像そのものを渡して採点する。
//
// ⚠️ 改善指示は文字列連結ではなく**構造化**して保存する。
//    adbanner は advice を appeal に文字列連結していたため、
//    何を指示したか・効いたかを後から追えず、世代を重ねるほど意図が薄まっていた。
import { visionJson } from './vision'
import type { AdCopy, FeedbackScores, RefineDirective } from './types'

export interface FeedbackInput {
  pngBase64: string
  copy: AdCopy
  brandName: string
  placementName: string
  /** ユーザーが押したチップ（「文字を大きく」など） */
  userRequests?: string[]
}

export interface FeedbackResult {
  scores: FeedbackScores
  advice: string
  directives: RefineDirective[]
}

interface RawFeedback {
  scores: Partial<FeedbackScores>
  advice: string
  directives: Array<{ target: string; instruction: string; reason: string }>
}

const TARGETS: RefineDirective['target'][] = ['copy', 'color', 'layout', 'contrast', 'visual']

function clampScore(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 3
  return Math.max(1, Math.min(5, Math.round(v)))
}

export async function evaluateCreative(input: FeedbackInput): Promise<FeedbackResult> {
  const { pngBase64, copy, brandName, placementName, userRequests = [] } = input

  const raw = await visionJson<RawFeedback>({
    pngBase64,
    maxTokens: 1600,
    prompt: [
      'あなたは広告クリエイティブのディレクターです。この広告画像を実際に見て、5段階（1〜5）で評価してください。',
      '',
      '【評価軸】',
      '- visibility（視認性）: 文字が実際に読めるか。字形が崩れていないか。背景に埋もれていないか。',
      '  ⚠️ ここは「見た目の推測」ではなく、画像の中の文字が本当に読めるかで採点してください。',
      '- appeal（訴求力）: 見出しが一目で意味を成し、興味を引くか。',
      '- cta（行動喚起）: CTAがボタンとして認識でき、押したくなるか。',
      '- fit（配置適合）: この配置（媒体の枠）で破綻していないか。文字が端で切れていないか。',
      '- brand（ブランド整合）: 配色とトーンに一貫性があるか。',
      '',
      '【改善指示（directives）の書き方】',
      '- 3件以内。効果が大きい順に並べてください。',
      '- target は copy / color / layout / contrast / visual のいずれか。',
      '- instruction は、画像生成AIにそのまま渡せる**具体的な指示文**にしてください。',
      '  （悪い例: 「見やすくする」／ 良い例: 「大見出しの背後に濃紺の帯を敷き、白抜き文字にする」）',
      '- reason には、画像のどこを見てそう判断したかを書いてください。',
      '- 直せる点が無ければ directives は空配列にしてください。無理に指摘を作らないこと。',
      '',
      '【出力するJSONの形式】',
      '{ "scores": { "visibility": 4, "appeal": 3, "cta": 4, "fit": 5, "brand": 4 },',
      '  "advice": "総評（150字程度）",',
      '  "directives": [{ "target": "contrast", "instruction": "...", "reason": "..." }] }',
      '',
      `【この画像に描かれているはずのテキスト】`,
      `  大見出し: 「${copy.headline}」`,
      `  サブコピー: 「${copy.sub}」`,
      `  CTA: 「${copy.cta}」`,
      `【ブランド】${brandName}`,
      `【配置】${placementName}`,
      userRequests.length > 0
        ? `\n【ユーザーからの要望（必ず directives に反映すること）】\n${userRequests.map((r) => `- ${r}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  })

  const s = raw?.scores || {}
  const scores: FeedbackScores = {
    visibility: clampScore(s.visibility),
    appeal: clampScore(s.appeal),
    cta: clampScore(s.cta),
    fit: clampScore(s.fit),
    brand: clampScore(s.brand),
    total: 0,
  }
  // 合計はモデルに出させずコードで計算する（内訳と合計が食い違うのを防ぐ）
  scores.total = scores.visibility + scores.appeal + scores.cta + scores.fit + scores.brand

  const directives: RefineDirective[] = (raw?.directives || [])
    .filter((d) => d && d.instruction)
    .slice(0, 3)
    .map((d) => ({
      target: TARGETS.includes(d.target as any) ? (d.target as RefineDirective['target']) : 'visual',
      instruction: String(d.instruction).slice(0, 500),
      reason: String(d.reason || '').slice(0, 500),
    }))

  return { scores, advice: String(raw?.advice || '').slice(0, 1000), directives }
}

/** ユーザーがボタンひとつで押せる改善チップ */
export const REFINE_CHIPS: Array<{ key: string; label: string; request: string }> = [
  { key: 'bigger_text', label: '文字を大きく', request: '大見出しをもっと大きく、画面を占める割合を増やしてください。' },
  { key: 'contrast', label: 'もっと見やすく', request: '文字と背景のコントラストを強め、必要なら文字の背後に単色のプレートを敷いてください。' },
  { key: 'simpler', label: 'シンプルに', request: '装飾要素を減らし、余白を活かした落ち着いた構成にしてください。' },
  { key: 'bolder', label: '目を引くように', request: '配色のコントラストを上げ、大胆で目を引く構図にしてください。' },
  { key: 'cta', label: 'CTAを目立たせる', request: 'CTAボタンをより大きく、彩度の高い色にして目立たせてください。' },
  { key: 'photo', label: '写真的に', request: '背景を写実的な写真調のビジュアルにしてください（人物の顔は写さないこと）。' },
  { key: 'illust', label: 'イラスト調に', request: '背景をフラットなイラスト調のビジュアルにしてください。' },
]

/** 構造化指示をプロンプトの追記文へ変換する */
export function directivesToPromptLines(directives: RefineDirective[]): string[] {
  return directives.map((d) => d.instruction)
}
