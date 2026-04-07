/**
 * 三ツ星アプリ 共通セーフティガード
 *
 * 1. 自傷・希死念慮の決定論的キーワード検知
 * 2. 薬機法・景表法NG語フィルタ
 * 3. 相談窓口情報の提供
 *
 * AI任せにせず、入力前・出力後の両側で機械的に判定する。
 */

/**
 * 危機ワード: ヒットした場合、通常の応答フローを停止して
 * セーフティエスカレーションを発火する。
 *
 * 完全一致ではなく includes で判定するため、表記揺れにもある程度対応する。
 */
export const SELF_HARM_KEYWORDS = [
  '死にたい',
  'しにたい',
  '死のう',
  'しのう',
  '消えたい',
  'きえたい',
  '自殺',
  'じさつ',
  '自傷',
  'リスカ',
  'リストカット',
  'od',
  'オーバードーズ',
  '飛び降り',
  '首を吊',
  '首吊り',
  'いなくなりたい',
  '殺して',
  'ころして',
  'もう無理',
  '生きていたくない',
  '生きる意味',
  '存在価値',
] as const

/**
 * 薬機法・景表法で問題になる語。
 * AI生成テキストの事後フィルタとして使う（該当ペルソナの返信をドロップする）。
 */
export const PHARMA_NG_WORDS = [
  '治る',
  '治す',
  '治療',
  '完治',
  '効く',
  '効果があります',
  'セラピー',
  'テラピー',
  '診断',
  '診察',
  'うつ病',
  '鬱病',
  '双極性',
  '統合失調',
  '発達障害',
  '医師監修',
  '必ず治ります',
  '絶対大丈夫',
  '絶対に治',
  '処方',
] as const

/** 入力テキストに危機ワードが含まれるかを判定 */
export function detectSelfHarmRisk(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return SELF_HARM_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/** 出力テキストに薬機法NG語が含まれるかを判定 */
export function containsPharmaNgWord(text: string): boolean {
  if (!text) return false
  return PHARMA_NG_WORDS.some((kw) => text.includes(kw))
}

/** 相談窓口リソース（検知時にUIへ返却する） */
export const SAFETY_RESOURCES = {
  locale: 'ja',
  intro:
    'あなたの言葉、ちゃんと受け取りました。もし今、本当につらいなら、専門の人に話せる場所があります。',
  disclaimer: '※ナグサメはAIで、専門家ではありません。',
  lines: [
    {
      name: 'よりそいホットライン',
      phone: '0120-279-338',
      hours: '24時間・無料',
      url: 'https://yorisoinetwork.com/',
    },
    {
      name: 'いのちの電話',
      phone: '0570-783-556',
      hours: '10:00〜22:00',
      url: 'https://www.inochinodenwa.org/',
    },
    {
      name: 'チャイルドライン（18歳まで）',
      phone: '0120-99-7777',
      hours: '16:00〜21:00',
      url: 'https://childline.or.jp/',
    },
  ],
} as const
