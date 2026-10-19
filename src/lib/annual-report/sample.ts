// ============================================
// 年間レポートの見本のデータ（画面の確認・テスト用）
// ============================================
// ⚠️ 実在しない名前だけを使う。DB は読まない。
import type { AnnualRawData, AnnualToolId } from './report'

/** 見本の件数（月ごと。1月〜12月） */
const PLAN: Partial<Record<AnnualToolId, number[]>> = {
  banner: [12, 18, 22, 15, 20, 26, 31, 24, 28, 35, 0, 0],
  seo: [2, 3, 4, 3, 5, 4, 6, 5, 4, 6, 0, 0],
  adimage: [0, 0, 8, 10, 12, 9, 14, 16, 12, 18, 0, 0],
  quote: [4, 6, 5, 7, 6, 8, 9, 7, 8, 10, 0, 0],
  shodan: [1, 2, 2, 3, 2, 4, 3, 3, 4, 5, 0, 0],
  doyaslide: [0, 1, 2, 1, 2, 3, 2, 2, 3, 3, 0, 0],
  sfa: [1, 2, 1, 3, 2, 2, 4, 3, 2, 3, 0, 0],
}

export function sampleAnnualRawData(year: number): AnnualRawData {
  const events: AnnualRawData['events'] = {}
  for (const [tool, months] of Object.entries(PLAN) as [AnnualToolId, number[]][]) {
    const list: Date[] = []
    months.forEach((n, m) => {
      // JST の15日 12:00
      for (let i = 0; i < n; i++) list.push(new Date(Date.UTC(year, m, 15, 3, 0, 0)))
    })
    events[tool] = list
  }
  return {
    companyName: '見本商事株式会社',
    events,
    amounts: { quoted: 18_400_000, won: 12_650_000 },
    customers: ['青空テック', '青空テック', '青空テック', 'みどり製作所', 'みどり製作所', '港町フーズ'],
    members: ['山田', '山田', '佐藤', '佐藤', '佐藤', '鈴木'],
  }
}
