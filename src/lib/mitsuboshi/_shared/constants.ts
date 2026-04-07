/**
 * 三ツ星アプリ シリーズ共通定数
 *
 * toCブランド「三ツ星アプリ」の共通情報。Vol.02以降もここを参照する。
 * ドヤAI（B向けSaaS）とは完全に独立したブランドとして扱う。
 */

export const MITSUBOSHI_BRAND = {
  seriesName: '三ツ星アプリ',
  seriesNameEn: 'MITSUBOSHI APPS',
  tagline: '今日のあなたに、☆☆☆を。',
  currentVolume: 1,
} as const

export const MITSUBOSHI_APPS = [
  {
    volume: 1,
    slug: 'nagusame',
    name: 'ナグサメ',
    nameEn: 'NAGUSAME',
    catchphrase: '大勢のこころが、そっと灯る夜に。',
    status: 'active' as const,
  },
] as const

/** Claude モデル（環境変数で上書き可能） */
export const MITSUBOSHI_CLAUDE_MODEL =
  process.env.MITSUBOSHI_CLAUDE_MODEL || 'claude-haiku-4-5-20251001'

/** 制限無効化フラグ（ローカル/検証用） */
export const MITSUBOSHI_DISABLE_LIMITS =
  process.env.MITSUBOSHI_DISABLE_LIMITS === 'true' ||
  process.env.MITSUBOSHI_DISABLE_LIMITS === '1'
