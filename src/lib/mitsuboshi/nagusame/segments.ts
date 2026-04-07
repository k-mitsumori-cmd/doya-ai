/**
 * ナグサメ セグメント定義
 *
 * 将来「ナグサメ(ビジネス)」「ナグサメ(学生)」等を追加するときは、
 * ここと personas/*.ts に1エントリ足すだけで済むように設計する。
 */

import type { NagusameSegment } from './types'

export interface NagusameSegmentMeta {
  id: NagusameSegment
  /** URL セグメント（`/nagusame/[segment]`） */
  slug: string
  /** 表示名 */
  displayName: string
  /** ヘッダーに出すサブタイトル */
  subtitle: string
  /** 投稿欄のプレースホルダー */
  placeholder: string
  /** アクセントカラー（Tailwindトークン `mitsuboshi-*` を想定） */
  accentToken: string
  /** MVPで公開済みか。false の場合 "Coming Soon" ページを表示 */
  published: boolean
}

export const NAGUSAME_SEGMENTS: Record<NagusameSegment, NagusameSegmentMeta> = {
  default: {
    id: 'default',
    slug: 'default',
    displayName: 'ナグサメ',
    subtitle: '今夜の星々が、あなたの言葉に応えます',
    placeholder: '今夜、誰にも言えなかったこと…',
    accentToken: 'mitsuboshi-champagne',
    published: true,
  },
  business: {
    id: 'business',
    slug: 'business',
    displayName: 'ナグサメ〈ビジネス〉',
    subtitle: '働くあなたに、そっと灯る星を',
    placeholder: '今日の仕事、つらかったこと…',
    accentToken: 'mitsuboshi-platinum',
    published: false,
  },
  student: {
    id: 'student',
    slug: 'student',
    displayName: 'ナグサメ〈学生〉',
    subtitle: 'がんばる毎日に、寄り添う星たちを',
    placeholder: '学校や勉強、部活のこと…',
    accentToken: 'mitsuboshi-sakura',
    published: false,
  },
}

/** URL セグメントから meta を取得。未知の値なら default を返す */
export function resolveSegment(slug: string | undefined): NagusameSegmentMeta {
  if (!slug) return NAGUSAME_SEGMENTS.default
  const found = Object.values(NAGUSAME_SEGMENTS).find((s) => s.slug === slug)
  return found || NAGUSAME_SEGMENTS.default
}
