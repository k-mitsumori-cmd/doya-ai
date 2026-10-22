// ============================================
// ドヤパワーの減る量の表（操作の名前 → 1回で減る量）
// ============================================
// ⚠️ 仮・2026-10-23（メインの指示。1ポイント ≈ 3円の見込み）。台帳の決まり（rules.ts）と合わせて見直す。
// ⚠️ ボタンの札（src/components/shell/power.tsx の ShellCostBadge）は、この表だけから引く。数をほかに書かない。
// ⚠️ ここは表示の数だけ。実際に台帳から減らす処理は、台帳の表が本番DBに入ってから、この表を使って作る。
// 0 の操作（勤怠・プロマネ・収入・支出）は、札を出さない。

/** 音声（AI商談・AI面接）の1分あたりの量。1分5（2026-10-23 ユーザー決定。仮の表の中で確定）。standard は原価の低い側（3）、high は高い側（5） */
export const VOICE_COST_PER_MINUTE = { standard: 3, high: 5 } as const
export type VoiceCostMode = keyof typeof VOICE_COST_PER_MINUTE
/** 音声は1分5（2026-10-23 ユーザー決定。仮の表の中で確定）。standard（3）に戻すときはここを変える */
export const VOICE_COST_MODE: VoiceCostMode = 'high'

export const DOYA_POWER_COSTS = {
  /** 文章の生成（営業管理の AI 次アクション・AI スコア、見積の品目の候補など）1回 */
  'text.generate': 1,
  /** バナーの生成 1回（3枚） */
  'banner.generate': 10,
  /** 画像の修正 1枚 */
  'image.refine': 7,
  /** 展示会の画像 1枚 */
  'tenjikai.image': 7,
  /** 文字起こし 60分ごと */
  'transcribe.hour': 10,
  /** インタビューの記事化 1回 */
  'interview.article': 20,
  /** スライドの生成 1回 */
  'slide.generate': 30,
  /** SEO 記事（1万字）1本 */
  'seo.article': 40,
  /** ペルソナの生成 1回 */
  'persona.generate': 50,
  /** 音声の AI商談・AI面接 1分ごと */
  'voice.minute': VOICE_COST_PER_MINUTE[VOICE_COST_MODE],
  /** AIO の手動スキャン 質問1件ごと */
  'aio.scan.question': 10,
  /** 勤怠・プロマネ・収入・支出は減らない */
  'kintai': 0,
  'promane': 0,
  'income': 0,
  'expense': 0,
} as const

export type DoyaPowerAction = keyof typeof DOYA_POWER_COSTS

/** 操作の減る量。units は件数（AIO の質問の数など）。表に無い操作は null */
export function doyaPowerCost(action: string, units = 1): number | null {
  const base = (DOYA_POWER_COSTS as Record<string, number>)[action]
  if (base === undefined) return null
  const n = Number.isFinite(units) && units > 0 ? units : 1
  return base * n
}
