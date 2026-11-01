// ============================================
// 今月のドヤ実績（外注に頼んだ場合の金額と時間に換算）
// ============================================
// 今月（日本時間）に作ったものの数を、同じものを外注に頼んだら・人が作ったら、の目安に換算する。
// ⚠️ 換算はあくまで目安。画面にも「目安」と出す。請求や契約の根拠には使わない。
// ⚠️ 数は DB の既存の記録だけから数える（load.server.ts）。有料の外部 API は呼ばない。
// ⚠️ 単価は 2026-10 時点の公開の相場（クラウドソーシングの募集・制作会社の料金表）の、低めの側に寄せた値。
//    大きく見せるための数字にしない。見直すときは、根拠のコメントも一緒に直す。

export type AchievementKind = 'seo_article' | 'banner' | 'copy' | 'interview' | 'quote' | 'shodan_prep'

export interface OutsourceRate {
  kind: AchievementKind
  label: string
  /** 数える単位（本・点・件） */
  unit: string
  /** 1単位を外注したときの金額（円・税抜き） */
  yenPerUnit: number
  /** 1単位を人が作るときの作業時間（分） */
  minutesPerUnit: number
  /** 何を数えるか（画面の注記） */
  counts: string
}

export const OUTSOURCE_RATES: Record<AchievementKind, OutsourceRate> = {
  // SEO 記事（既定の目安は1万字）。クラウドソーシングの文字単価は 1.5〜3円が多く、低めの 2円 × 1万字 = 2万円。
  // 時間は、構成づくり・執筆・見直しで 1時間に約1,500字として 約7時間（420分）。
  seo_article: { kind: 'seo_article', label: 'SEO 記事', unit: '本', yenPerUnit: 20_000, minutesPerUnit: 420, counts: 'できあがった記事' },
  // バナー1点。クラウドソーシングの単発の募集は 5,000〜15,000円が多く、低めの 5,000円。
  // 時間は、ラフ・制作・書き出しで 約1.5時間（90分）。
  banner: { kind: 'banner', label: 'バナー', unit: '点', yenPerUnit: 5_000, minutesPerUnit: 90, counts: '作ったバナー' },
  // 広告・販促のコピー1回分（数案）。コピーライターへの小さな依頼は 5,000〜20,000円が多く、低めの 5,000円。
  // 時間は、案出しと見直しで 約1時間（60分）。
  copy: { kind: 'copy', label: 'コピー', unit: '件', yenPerUnit: 5_000, minutesPerUnit: 60, counts: '作ったコピー' },
  // インタビュー記事1本（取材の文字起こし・構成・執筆）。ライターの取材記事は 3〜8万円が多く、低めの 3万円。
  // 時間は、文字起こし 2時間・構成と執筆 4時間 で 約6時間（360分）。
  interview: { kind: 'interview', label: 'インタビュー記事', unit: '本', yenPerUnit: 30_000, minutesPerUnit: 360, counts: '仕上げた記事' },
  // 見積書1件の作成。事務の代行の時給 2,000〜3,000円 × 30分 の、低めの 1,000円。
  // 時間は、品目と金額を表計算で組み、書式に起こして 約30分。
  quote: { kind: 'quote', label: '見積書', unit: '件', yenPerUnit: 1_000, minutesPerUnit: 30, counts: '確定か送付をした見積' },
  // 商談準備の資料1件（相手の会社の調べもの・課題の仮説・提案の骨子）。リサーチの代行は 1〜5万円が多く、低めの 1万円。
  // 時間は、調べもの 2時間・まとめ 1時間 で 約3時間（180分）。
  shodan_prep: { kind: 'shodan_prep', label: '商談準備の資料', unit: '件', yenPerUnit: 10_000, minutesPerUnit: 180, counts: 'できあがった資料' },
}

export const ACHIEVEMENT_ORDER: AchievementKind[] = ['seo_article', 'banner', 'copy', 'interview', 'quote', 'shodan_prep']

export interface AchievementLine extends OutsourceRate {
  count: number
  yen: number
  minutes: number
}

export interface MonthlyAchievements {
  monthKey: string
  lines: AchievementLine[]
  totalCount: number
  totalYen: number
  totalMinutes: number
}

/** 今月の数から、換算した金額と時間を出す。0件の行も残す（何が数えられるかを見せるため） */
export function monthlyAchievements(monthKey: string, counts: Partial<Record<AchievementKind, number>>): MonthlyAchievements {
  const lines = ACHIEVEMENT_ORDER.map((kind) => {
    const r = OUTSOURCE_RATES[kind]
    const raw = counts[kind] ?? 0
    const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
    return { ...r, count, yen: count * r.yenPerUnit, minutes: count * r.minutesPerUnit }
  })
  return {
    monthKey,
    lines,
    totalCount: lines.reduce((s, l) => s + l.count, 0),
    totalYen: lines.reduce((s, l) => s + l.yen, 0),
    totalMinutes: lines.reduce((s, l) => s + l.minutes, 0),
  }
}

/** 分を「12時間30分」の形に */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}分`
  return r === 0 ? `${h}時間` : `${h}時間${r}分`
}

/** 円を「1,234,000円」の形に */
export function formatYen(yen: number): string {
  return `${Math.round(yen).toLocaleString('ja-JP')}円`
}
