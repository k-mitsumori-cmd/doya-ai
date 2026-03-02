export type ContentScore = {
  score: number
  charCount: number
  headingCount: number
  tableCount: number
  linkCount: number
  imageCount: number
  faqCount: number
}

export function analyzeMarkdown(markdown: string): ContentScore {
  const md = markdown || ''
  const charCount = md.replace(/\s+/g, '').length
  const headingCount = (md.match(/^#{2,4}\s+/gm) || []).length
  const tableCount = (md.match(/^\|.*\|$/gm) || []).length >= 3 ? 1 : 0 // 雑に判定（最低限）
  const linkCount = (md.match(/\[[^\]]*?\]\((https?:\/\/[^)\s]+)\)/g) || []).length
  const imageCount = (md.match(/^!\[[^\]]*?\]\([^)]+\)/gm) || []).length
  const faqCount = (md.match(/^#+\s+FAQ\b/gmi) || []).length ? 6 : (md.match(/Q[:：]/g) || []).length

  // ざっくりスコア（SaaS系SEOツールの考え方を真似た"健康診断"）
  // - 文字数: 20k以上で加点（上限あり）
  // - 見出し: 12以上で加点
  // - リンク/画像/表/FAQ: 要素が揃うほど加点
  let score = 0
  score += Math.min(35, Math.round(charCount / 800)) // ~28kで35点上限
  score += Math.min(15, headingCount)
  score += Math.min(10, linkCount)
  score += Math.min(10, imageCount * 2)
  score += tableCount ? 8 : 0
  score += faqCount ? 12 : 0

  score = Math.max(0, Math.min(100, score))
  return { score, charCount, headingCount, tableCount, linkCount, imageCount, faqCount }
}

