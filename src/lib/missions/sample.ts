// 見本のデータ（ログイン・DB 不要のプレビューとテストで使う）。⚠️ 本番の画面では使わない
import type { MissionsInput } from './view'

/** now を日本時間の「今日」として、今日・今月の操作を並べる */
export function sampleMissionsInput(now: Date | number): MissionsInput {
  const t = new Date(now).getTime()
  const ago = (h: number) => new Date(t - h * 3600_000).toISOString()
  return {
    companyName: 'サンプル株式会社',
    tools: { quote: true, sfa: true },
    facts: {
      company: { name: 'サンプル株式会社', industry: '広告・制作', websiteUrl: null, at: ago(24 * 9) },
      acceptedInvites: [],
      actions: [
        { kind: 'quote_issued', id: 'q1', at: ago(24 * 6), title: 'Webサイト保守（年間）', clientCompany: '東和商事', totalExclTax: 480_000, lines: [{ itemName: '保守（月額）', qty: 12, unitPrice: 40_000 }] },
        { kind: 'activity_logged', id: 'a1', at: ago(24 * 3), type: 'meeting', subject: '提案の打ち合わせ', body: '先方の課題は採用ページの離脱。次回までに改善案を3つ用意する。', aiGenerated: false },
        { kind: 'deal_saved', id: 'd1', at: ago(24 * 2), name: '採用LP制作', amount: 1_200_000, expectedCloseDate: ago(-24 * 20) },
        // 今日: 空の見積（数えない）と、文字起こしからの記録（数えない）だけ
        { kind: 'quote_issued', id: 'q2', at: ago(2), title: '無題', clientCompany: null, totalExclTax: 0, lines: [] },
        { kind: 'activity_logged', id: 'a2', at: ago(1), type: 'call', subject: '電話', body: '', aiGenerated: true },
      ],
    },
    counts: { seo_article: 6, banner: 18, copy: 4, interview: 1, quote: 7, shodan_prep: 3 },
  }
}
