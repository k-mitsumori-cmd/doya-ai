// ============================================
// 経営ホームの見出し。開くたびに変わる言葉の候補から選ぶ（画面に依らない部品）
// ============================================
// 2026-10-30 本人の指示（メイン経由）:「今日は何をしますか？じゃなくて、もっといろんなワードを出すように。ドヤバディにかけて、何を一緒にやりますか？など」「なんでも任せてください！など」。
// - 問いかけ型（〜しますか？）と、名乗り出る型（任せてください！）を、だいたい半々にする。丁寧な言い方で、相棒らしさ・頼もしさ・少しのユーモア。
// - 見出しの「！」は1つまで。問いかけには「！」を付けない。
// - 朝・昼・夜で出す言葉がある（日本時間）。名前の入った言葉（ドヤバディ）は、名前の旗が on のときだけ候補に入れる。
// - 言葉はサーバー側（経営ホームのページ）で決めて props で渡す。サーバーとブラウザで違う言葉が出てちらつかないため。
export type HeadlineKind = 'ask' | 'offer'
export type TimeOfDay = 'morning' | 'noon' | 'night'

export interface Headline {
  text: string
  kind: HeadlineKind
  /** この時間帯だけ出す。無ければ1日じゅう */
  when?: TimeOfDay
  /** サービス名「ドヤバディ」や「部下」が入る言葉。名前の旗が on のときだけ候補に入れる */
  named?: true
}

/** 見出しの既定（言葉が渡されないとき・見本の画面） */
export const DEFAULT_HEADLINE = '今日は、何を一緒にやりますか？'

export const HEADLINES: readonly Headline[] = [
  // ---- 問いかけ型 ----
  { text: '今日は、何を一緒にやりますか？', kind: 'ask' },
  { text: '今日は、何から片づけましょうか？', kind: 'ask' },
  { text: '相棒に任せたい仕事は、ありますか？', kind: 'ask' },
  { text: '今日は、どの仕事を一緒に進めますか？', kind: 'ask' },
  { text: '手が回らない仕事は、ありますか？', kind: 'ask' },
  { text: 'まず、何から始めましょうか？', kind: 'ask' },
  { text: 'いま、いちばん気になる仕事は何ですか？', kind: 'ask' },
  { text: 'おはようございます。今日は何を一緒にやりますか？', kind: 'ask', when: 'morning' },
  { text: '午後は、何から進めましょうか？', kind: 'ask', when: 'noon' },
  { text: 'ドヤバディに、何を頼みますか？', kind: 'ask', named: true },
  { text: 'バディに任せたい仕事は、ありますか？', kind: 'ask', named: true },
  // ---- 名乗り出る型 ----
  { text: 'なんでも任せてください！', kind: 'offer' },
  { text: '今日も、ドンと任せてください！', kind: 'offer' },
  { text: 'その仕事、お引き受けします！', kind: 'offer' },
  { text: 'どんな仕事でも、まずは話してください！', kind: 'offer' },
  { text: '今日の「丸投げ」、お預かりします。', kind: 'offer' },
  { text: 'まずは、何でも話してください。', kind: 'offer' },
  { text: '面倒な仕事、こちらで引き受けます。', kind: 'offer' },
  { text: '今日も、二人三脚でいきましょう。', kind: 'offer' },
  { text: 'お疲れさまです。残りの仕事、引き受けますよ。', kind: 'offer', when: 'night' },
  { text: 'ドヤバディが、今日も一緒に動きます。', kind: 'offer', named: true },
  { text: 'ドヤバディに、お任せください！', kind: 'offer', named: true },
]

/** 日本時間の「時」（0〜23）から時間帯。5〜10時 = 朝、11〜16時 = 昼、それ以外 = 夜 */
export function timeOfDay(hour: number): TimeOfDay {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 5 && h <= 10) return 'morning'
  if (h >= 11 && h <= 16) return 'noon'
  return 'night'
}

/** いまの候補（時間帯に合うもの・旗が on のときだけ名前入り） */
export function headlineCandidates(opts: { renamed: boolean; hour: number }): Headline[] {
  const tod = timeOfDay(opts.hour)
  return HEADLINES.filter((h) => (!h.named || opts.renamed) && (!h.when || h.when === tod))
}

/** 見出しの言葉を1つ選ぶ。rand は 0 以上 1 未満の乱数（試験では固定の値を渡す） */
export function pickHeadline(opts: { renamed: boolean; hour: number }, rand: () => number = Math.random): string {
  const list = headlineCandidates(opts)
  const i = Math.min(list.length - 1, Math.max(0, Math.floor(rand() * list.length)))
  return list[i]?.text ?? DEFAULT_HEADLINE
}

/** 日本時間の「時」を、いまの時刻から読む（サーバーで使う） */
export function japanHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(now)
  const n = Number(h)
  return Number.isFinite(n) ? n % 24 : 12
}

/** 名前の旗（NEXT_PUBLIC_BRAND_RENAME_ROLLOUT）が all か。空白と大文字小文字は許す（src/lib/brand/flag.ts と同じ決まり。brand が入ったら、そちらに寄せる） */
export function brandRenamedFlag(raw: string | undefined = process.env.NEXT_PUBLIC_BRAND_RENAME_ROLLOUT): boolean {
  return (raw ?? '').trim().toLowerCase() === 'all'
}
