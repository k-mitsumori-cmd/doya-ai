/** The collection API is the source of the industry's fallback search words. */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'IT・ソフトウェア': ['システム', 'ソフトウェア', 'IT'],
  '製造業': ['製造', '工業', '製作'],
  '小売・EC': ['販売', '商事', 'リテール'],
  '医療・介護': ['医療', '介護', 'ヘルスケア'],
  '教育': ['学習', '教育', 'スクール'],
  '金融・保険': ['金融', '保険'],
  '不動産': ['不動産', '住宅'],
  '飲食': ['フード', '食品', '飲食'],
  '物流': ['物流', '運輸', '配送'],
  '建設': ['建設', '建築', '工務'],
  'コンサル': ['コンサルティング', 'コンサル'],
  '広告・マーケ': ['広告', 'マーケティング', 'プロモーション'],
  '人材': ['人材', 'スタッフ'],
  'その他': ['株式会社'],
}

export function resolveDoyalistSearchKeywords(industry: string, raw: string): string[] {
  const words = raw.split(/[,、 \n]/).map(word => word.trim()).filter(Boolean)
  const fallback = Object.prototype.hasOwnProperty.call(INDUSTRY_KEYWORDS, industry) ? INDUSTRY_KEYWORDS[industry] : ['株式会社']
  // Both collection providers use the first three keywords.
  return (words.length ? words : fallback).slice(0, 3)
}
