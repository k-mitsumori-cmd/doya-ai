// ========================================
// ドヤ診断AI - ビジネス診断API（徹底分析版）
// 多次元スコアリング + Webサイト深掘り + 辛口AI診断
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SHINDAN_PRICING,
  getShindanDailyLimitByUserPlan,
  shouldResetDailyUsage,
  getTodayDateJST,
  isWithinFreeHour,
} from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// =============================================
// 1. HTML解析ユーティリティ（強化版）
// =============================================
function extractTextFromHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1].trim()
  const metaRegex = /<meta[^>]+>/gi
  let m
  while ((m = metaRegex.exec(html)) !== null) {
    const tag = m[0]
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i)
    const contentMatch = tag.match(/content=["']([^"']+)["']/i)
    if (nameMatch && contentMatch) meta[nameMatch[1]] = contentMatch[1]
  }
  return meta
}

function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const regex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let m
  while ((m = regex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text) headings.push(text)
  }
  return headings.slice(0, 30)
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const regex = /href=["'](\/[^"'#?]*|https?:\/\/[^"'#?]*)/gi
  let m
  const base = new URL(baseUrl)
  while ((m = regex.exec(html)) !== null) {
    try {
      const url = new URL(m[1], baseUrl)
      if (url.hostname === base.hostname && !links.includes(url.pathname)) {
        links.push(url.pathname)
      }
    } catch {}
  }
  return links.filter((p) => p !== '/' && p.length > 1).slice(0, 30)
}

function countImages(html: string): { total: number; withAlt: number } {
  const imgs = html.match(/<img[^>]+>/gi) || []
  const withAlt = imgs.filter((tag) => /alt=["'][^"']+["']/i.test(tag)).length
  return { total: imgs.length, withAlt }
}

function hasCTA(html: string): boolean {
  return /<form[^>]*>/i.test(html) || /contact|お問い合わせ|資料請求|無料|体験|デモ|申し込み|相談/i.test(html)
}

function hasBlogSection(links: string[]): boolean {
  return links.some((l) => /blog|news|column|journal|記事|お知らせ|コラム|ブログ/i.test(l))
}

function detectSocialLinks(html: string): string[] {
  const socials: string[] = []
  if (/twitter\.com|x\.com/i.test(html)) socials.push('X')
  if (/facebook\.com/i.test(html)) socials.push('Facebook')
  if (/instagram\.com/i.test(html)) socials.push('Instagram')
  if (/youtube\.com/i.test(html)) socials.push('YouTube')
  if (/linkedin\.com/i.test(html)) socials.push('LinkedIn')
  if (/line\.me|lin\.ee/i.test(html)) socials.push('LINE')
  if (/tiktok\.com/i.test(html)) socials.push('TikTok')
  return socials
}

// =============================================
// 2. Webサイト深掘り分析エンジン
// =============================================
interface WebsiteAnalysis {
  url: string
  seoScore: number
  contentScore: number
  technicalScore: number
  totalScore: number
  issues: string[]
  positives: string[]
  meta: Record<string, string>
  headings: string[]
  textLength: number
  pagesCrawled: number
  socialLinks: string[]
  hasBlog: boolean
  hasForm: boolean
  hasSchema: boolean
  imageStats: { total: number; withAlt: number }
  textExcerpt: string
  ogImage: string | null
}

async function fetchPage(url: string, timeout = 10000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaShindanBot/2.0; +https://doya-ai.surisuta.jp)' },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function analyzeWebsite(url: string): Promise<WebsiteAnalysis | null> {
  const mainHtml = await fetchPage(url, 15000)
  if (!mainHtml) return null

  const meta = extractMetaTags(mainHtml)
  const headings = extractHeadings(mainHtml)
  const mainText = extractTextFromHTML(mainHtml)
  const internalLinks = extractInternalLinks(mainHtml, url)
  const images = countImages(mainHtml)
  const hasSchema = /application\/ld\+json/i.test(mainHtml)
  const hasForm = hasCTA(mainHtml)
  const socialLinks = detectSocialLinks(mainHtml)
  const blog = hasBlogSection(internalLinks)

  // 追加ページクロール（重要ページを優先、並列実行）
  const priorityPaths = internalLinks
    .filter((p) => /about|company|service|product|blog|news|price|feature|会社|サービス|料金|事業|特徴|実績|お客様/i.test(p))
    .slice(0, 5)

  const subPages = await Promise.all(
    priorityPaths.map((path) => fetchPage(new URL(path, url).toString(), 8000))
  )
  const validSubPages = subPages.filter(Boolean) as string[]
  const pagesCrawled = 1 + validSubPages.length

  let totalText = mainText
  for (const page of validSubPages) {
    totalText += ' ' + extractTextFromHTML(page).slice(0, 3000)
  }

  // ----- SEOスコア計算（100点満点・厳格採点）-----
  const issues: string[] = []
  const positives: string[] = []
  let seoScore = 0

  // title (15点)
  if (meta.title && meta.title.length >= 10 && meta.title.length <= 60) {
    seoScore += 15; positives.push(`titleタグ最適（${meta.title.length}文字）`)
  } else if (meta.title) {
    seoScore += 8; issues.push(`titleタグの長さが不適切（${meta.title.length}文字、推奨10-60文字）`)
  } else {
    issues.push('titleタグ未設定（SEO最重要項目の欠落）')
  }

  // meta description (12点)
  const desc = meta.description || meta['og:description']
  if (desc && desc.length >= 50 && desc.length <= 160) {
    seoScore += 12; positives.push('meta description最適')
  } else if (desc) {
    seoScore += 5; issues.push(`meta description長が不適切（${desc.length}文字、推奨50-160文字）`)
  } else {
    issues.push('meta description未設定（検索結果でのCTR低下）')
  }

  // OGP完全性 (15点)
  let ogpCount = 0
  if (meta['og:title']) ogpCount++
  if (meta['og:description']) ogpCount++
  if (meta['og:image']) ogpCount++
  if (meta['og:url']) ogpCount++
  if (meta['og:type']) ogpCount++
  seoScore += Math.round((ogpCount / 5) * 15)
  if (ogpCount >= 4) positives.push(`OGP設定充実（${ogpCount}/5項目）`)
  else if (ogpCount <= 2) issues.push(`OGP設定不足（${ogpCount}/5項目、SNSシェア時の露出機会損失）`)

  // h1 (10点)
  const h1Count = (mainHtml.match(/<h1[^>]*>/gi) || []).length
  if (h1Count === 1) { seoScore += 10; positives.push('h1タグ適切（1つ）') }
  else if (h1Count === 0) { issues.push('h1タグなし（検索エンジンにページ主題を伝えられていない）') }
  else { seoScore += 3; issues.push(`h1タグ${h1Count}個（1つに統一すべき）`) }

  // 見出し構造 (8点)
  const h2Count = (mainHtml.match(/<h2[^>]*>/gi) || []).length
  if (h2Count >= 3 && headings.length >= 5) { seoScore += 8; positives.push(`見出し構造良好（h2: ${h2Count}個）`) }
  else if (h2Count >= 1) { seoScore += 4; issues.push('見出し構造が不十分（コンテンツ構成力が弱い）') }
  else { issues.push('h2見出しなし（ページ内構成が致命的に弱い）') }

  // 構造化データ (10点)
  if (hasSchema) { seoScore += 10; positives.push('構造化データ（JSON-LD）実装済み') }
  else { issues.push('構造化データなし（リッチスニペット表示の機会損失）') }

  // canonical (8点)
  if (meta.canonical || /rel=["']canonical["']/i.test(mainHtml)) { seoScore += 8 }
  else { issues.push('canonicalタグ未設定（重複コンテンツリスク）') }

  // 画像alt (7点)
  if (images.total > 0) {
    const altRatio = images.withAlt / images.total
    seoScore += Math.round(altRatio * 7)
    if (altRatio < 0.5) issues.push(`画像alt属性不足（${images.withAlt}/${images.total}枚）`)
    else if (altRatio >= 0.8) positives.push('画像alt属性充実')
  } else {
    seoScore += 3 // 画像なし（良くも悪くもない）
  }

  // サイトマップ確認 (5点)
  const sitemapHtml = await fetchPage(new URL('/sitemap.xml', url).toString(), 5000)
  if (sitemapHtml && sitemapHtml.includes('<url>')) { seoScore += 5; positives.push('sitemap.xml設置済み') }
  else { issues.push('sitemap.xml未設置（クローラビリティに悪影響）') }

  // robots.txt確認 (5点)
  const robotsTxt = await fetchPage(new URL('/robots.txt', url).toString(), 5000)
  if (robotsTxt && robotsTxt.length > 10) { seoScore += 5 }
  else { issues.push('robots.txt未設定') }

  // ----- コンテンツスコア計算 -----
  let contentScore = 0
  const wordCount = totalText.length

  // テキスト量 (25点)
  if (wordCount > 15000) { contentScore += 25; positives.push(`豊富なコンテンツ量（${Math.round(wordCount / 1000)}K文字）`) }
  else if (wordCount > 8000) { contentScore += 18 }
  else if (wordCount > 3000) { contentScore += 10; issues.push('コンテンツ量が少ない（情報発信力不足）') }
  else { contentScore += 3; issues.push('コンテンツ量が非常に少ない（集客力に深刻な影響）') }

  // ブログ・コラム (20点)
  if (blog) { contentScore += 20; positives.push('ブログ/コラムセクション確認') }
  else { issues.push('ブログ/コラムなし（コンテンツマーケティング未実施。集客手段が限定的）') }

  // CTA・コンバージョン導線 (20点)
  if (hasForm) { contentScore += 20; positives.push('CTA/問い合わせ導線あり') }
  else { issues.push('CTA/問い合わせフォーム未検出（コンバージョン導線の致命的欠落）') }

  // サイト規模 (15点)
  if (pagesCrawled >= 5) { contentScore += 15 }
  else if (pagesCrawled >= 3) { contentScore += 10 }
  else if (pagesCrawled >= 2) { contentScore += 5; issues.push('サブページが少ない（サイト規模不足）') }
  else { issues.push('サブページなし（ペラサイトの可能性。信頼性に影響）') }

  // SNS連携 (10点)
  if (socialLinks.length >= 3) { contentScore += 10; positives.push(`SNS連携充実（${socialLinks.join(', ')}）`) }
  else if (socialLinks.length >= 1) { contentScore += 5 }
  else { issues.push('SNSリンクなし（ソーシャルメディア活用ゼロ）') }

  // 内部リンク密度 (10点)
  if (internalLinks.length >= 15) { contentScore += 10 }
  else if (internalLinks.length >= 8) { contentScore += 6 }
  else { contentScore += 2; issues.push(`内部リンクが少ない（${internalLinks.length}本、回遊性低い）`) }

  // ----- テクニカルスコア計算 -----
  let technicalScore = 0

  // SSL (25点)
  if (url.startsWith('https')) { technicalScore += 25; positives.push('HTTPS対応') }
  else { issues.push('HTTP非暗号化通信（セキュリティ・SEO・ブラウザ警告で三重苦）') }

  // モバイル対応 (25点)
  if (/name=["']viewport["']/i.test(mainHtml)) { technicalScore += 25; positives.push('モバイルviewport設定') }
  else { issues.push('viewport未設定（モバイル非対応の可能性。検索順位に致命的影響）') }

  // HTMLサイズ (15点)
  const htmlSize = mainHtml.length
  if (htmlSize < 200000) { technicalScore += 15 }
  else if (htmlSize < 500000) { technicalScore += 8; issues.push('HTMLサイズが大きい（表示速度に影響）') }
  else { issues.push('HTMLサイズ過大（表示速度が著しく遅い可能性）') }

  // 内部リンク構造 (15点)
  if (internalLinks.length >= 10) { technicalScore += 15 }
  else if (internalLinks.length >= 5) { technicalScore += 8 }
  else { technicalScore += 2 }

  // サブページ到達性 (10点)
  if (validSubPages.length >= 3) { technicalScore += 10 }
  else if (validSubPages.length >= 1) { technicalScore += 5 }

  // Twitter Card / OGP (10点)
  if (meta['twitter:card'] || meta['twitter:site']) { technicalScore += 5 }
  if (meta['og:image'] && meta['og:title']) { technicalScore += 5 }

  const totalScore = Math.round(seoScore * 0.40 + contentScore * 0.35 + technicalScore * 0.25)

  return {
    url,
    seoScore: Math.min(100, seoScore),
    contentScore: Math.min(100, contentScore),
    technicalScore: Math.min(100, technicalScore),
    totalScore: Math.min(100, totalScore),
    issues,
    positives,
    meta,
    headings,
    textLength: wordCount,
    pagesCrawled,
    socialLinks,
    hasBlog: blog,
    hasForm: hasForm,
    hasSchema: hasSchema,
    imageStats: images,
    textExcerpt: mainText.slice(0, 4000),
    ogImage: meta['og:image']
      ? (meta['og:image'].startsWith('http') ? meta['og:image'] : (() => { try { return new URL(meta['og:image'], url).toString() } catch { return null } })())
      : null,
  }
}

// =============================================
// 3. JSON修復ユーティリティ
// =============================================
function repairJson(str: string): string {
  let jsonStr = str.trim()
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) jsonStr = jsonMatch[1].trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }
  const ob = (jsonStr.match(/{/g) || []).length
  const cb = (jsonStr.match(/}/g) || []).length
  const oB = (jsonStr.match(/\[/g) || []).length
  const cB = (jsonStr.match(/]/g) || []).length
  if (oB > cB) jsonStr += ']'.repeat(oB - cB)
  if (ob > cb) jsonStr += '}'.repeat(ob - cb)
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
  return jsonStr
}

// =============================================
// 4. カテゴリ定義・重み
// =============================================
const CATEGORY_LABELS: Record<string, string> = {
  marketing: '集客力',
  sales: '営業力',
  customer: '顧客対応力',
  organization: '組織力',
  finance: '財務健全性',
  digital: 'デジタル活用',
  strategy: '経営戦略',
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  marketing: 0.20,
  sales: 0.18,
  customer: 0.15,
  organization: 0.15,
  finance: 0.12,
  digital: 0.10,
  strategy: 0.10,
}

// =============================================
// 5. 多次元スコアリングエンジン
// =============================================

// --- 5a. 非線形スケール採点（甘い採点を排除）---
// 旧: 0/25/50/75/100 → 新: 10/25/45/70/88
const SCALE5_SCORES = [10, 25, 45, 70, 88]

const SCALE5_OPTIONS: Record<string, string[]> = {
  leadCount: ['ほぼなし', '月1〜10件', '月11〜50件', '月51〜100件', '月100件以上'],
  measurementMaturity: ['未実施', '一部実施', '定期測定', '分析→改善', '高度に最適化'],
  contentMarketing: ['未着手', '検討中', '開始済み', '定期発信中', '成果実績あり'],
  closeRate: ['〜10%', '11〜20%', '21〜40%', '41〜60%', '60%以上'],
  salesProcess: ['完全に属人的', '一部共有', 'マニュアル化', 'CRM/SFA活用', 'AI活用'],
  leadTime: ['3ヶ月以上', '2〜3ヶ月', '1〜2ヶ月', '2週間〜1ヶ月', '2週間未満'],
  salesAnalysis: ['未実施', '勘と経験', 'Excel管理', 'BI活用', '予測分析'],
  repeatRate: ['〜10%', '11〜30%', '31〜50%', '51〜70%', '70%以上'],
  feedbackCollection: ['未実施', '不定期', '定期収集', 'NPS等で定量化', '改善サイクル連動'],
  afterFollow: ['体制なし', '問合せ対応のみ', '定期連絡', '専任CS担当', '自動+個別最適化'],
  hiringDifficulty: ['非常に困難', 'やや困難', '普通', '比較的容易', '問題なし'],
  roleClarity: ['不明確', '一部不明確', 'おおむね明確', '明確', '評価制度と連動'],
  training: ['制度なし', 'OJTのみ', '年数回の研修', '体系的プログラム', '個別最適化'],
  visionAlignment: ['未策定', '経営層のみ', '一部共有', '全社浸透', '行動指針と連動'],
  growthTrend: ['大幅減少', 'やや減少', '横ばい', '成長中', '急成長'],
  profitMargin: ['赤字', '薄利', '業界並み', 'やや高い', '高い'],
  customerConcentration: ['1社依存', '上位3社で過半', 'やや集中', '分散', '高度に分散'],
  automationLevel: ['ほぼ手作業', '一部自動化', '主要業務を自動化', '全体最適化', 'AI活用自動化'],
  dataAccess: ['バラバラ管理', '一部統合', 'ダッシュボードあり', 'リアルタイム可視化', '予測分析可能'],
  competitiveAdvantage: ['特になし', '価格競争力', '品質・技術力', 'スピード・柔軟性', 'ブランド+独自性'],
}

function enhancedScale5Score(value: string, qId: string): number {
  const opts = SCALE5_OPTIONS[qId]
  if (!opts) return 30
  const idx = opts.indexOf(value)
  return idx >= 0 ? SCALE5_SCORES[idx] : 30
}

// --- 5b. マルチセレクト採点（逓減収益）---
function enhancedMultiselectScore(selected: string | string[]): number {
  if (!selected || !Array.isArray(selected) || selected.length === 0) return 5
  if (selected.includes('特になし')) return 5
  const count = selected.filter((v) => v !== '特になし').length
  // 逓減: 1→18, 2→32, 3→48, 4→62, 5→74, 6+→84
  const scores = [5, 18, 32, 48, 62, 74, 84]
  return scores[Math.min(count, 6)]
}

// --- 5c. カテゴリ内質問別重み付け ---
const QUESTION_WEIGHTS: Record<string, Record<string, number>> = {
  marketing: { channels: 0.25, leadCount: 0.30, measurementMaturity: 0.25, contentMarketing: 0.20 },
  sales: { closeRate: 0.30, salesProcess: 0.25, leadTime: 0.20, salesAnalysis: 0.25 },
  customer: { repeatRate: 0.40, feedbackCollection: 0.30, afterFollow: 0.30 },
  organization: { hiringDifficulty: 0.20, roleClarity: 0.25, training: 0.25, visionAlignment: 0.30 },
  finance: { growthTrend: 0.40, profitMargin: 0.35, customerConcentration: 0.25 },
  digital: { toolsUsed: 0.25, automationLevel: 0.40, dataAccess: 0.35 },
  strategy: { competitiveAdvantage: 1.0 },
}

const CATEGORY_QUESTION_IDS: Record<string, { scale5: string[]; multiselect: string[] }> = {
  marketing: { scale5: ['leadCount', 'measurementMaturity', 'contentMarketing'], multiselect: ['channels'] },
  sales: { scale5: ['closeRate', 'salesProcess', 'leadTime', 'salesAnalysis'], multiselect: [] },
  customer: { scale5: ['repeatRate', 'feedbackCollection', 'afterFollow'], multiselect: [] },
  organization: { scale5: ['hiringDifficulty', 'roleClarity', 'training', 'visionAlignment'], multiselect: [] },
  finance: { scale5: ['growthTrend', 'profitMargin', 'customerConcentration'], multiselect: [] },
  digital: { scale5: ['automationLevel', 'dataAccess'], multiselect: ['toolsUsed'] },
  strategy: { scale5: ['competitiveAdvantage'], multiselect: [] },
}

function weightedCategoryScore(catId: string, answers: Record<string, string | string[]>): number {
  const def = CATEGORY_QUESTION_IDS[catId]
  const weights = QUESTION_WEIGHTS[catId]
  if (!def || !weights) return 0
  let totalW = 0
  let wSum = 0
  for (const qId of def.scale5) {
    const w = weights[qId] || 0
    if (w === 0) continue
    wSum += enhancedScale5Score(answers[qId] as string, qId) * w
    totalW += w
  }
  for (const qId of def.multiselect) {
    const w = weights[qId] || 0
    if (w === 0) continue
    wSum += enhancedMultiselectScore(answers[qId]) * w
    totalW += w
  }
  return totalW > 0 ? Math.round(wSum / totalW) : 0
}

// --- 5d. クロスカテゴリ・シナジーペナルティ ---
interface SynergyPenalty {
  name: string
  penalty: number
  description: string
}

function calculateSynergyPenalties(scores: Record<string, number>): SynergyPenalty[] {
  const penalties: SynergyPenalty[] = []
  const has = (id: string) => scores[id] !== undefined

  if (has('marketing') && has('sales') && scores.marketing > 55 && scores.sales < 35) {
    penalties.push({
      name: 'リード取りこぼし',
      penalty: -8,
      description: '集客力はあるが営業プロセスが脆弱。獲得リードの大半が成約に至っていない可能性',
    })
  }

  if (has('digital') && scores.digital < 30) {
    const highOthers = Object.entries(scores).filter(([k, v]) => k !== 'digital' && v > 55).length
    if (highOthers >= 2) {
      penalties.push({
        name: 'デジタル化の足枷',
        penalty: -6,
        description: '事業の一部は成長しているがDX未着手が全体効率を押し下げている',
      })
    }
  }

  if (has('organization') && scores.organization < 35) {
    const highOthers = Object.entries(scores).filter(([k, v]) => k !== 'organization' && v > 50).length
    if (highOthers >= 2) {
      penalties.push({
        name: '組織崩壊リスク',
        penalty: -7,
        description: '事業は伸びているが組織の仕組みが追いついていない。属人化・離職の温床',
      })
    }
  }

  if (has('customer') && has('marketing') && scores.customer < 35 && scores.marketing > 50) {
    penalties.push({
      name: 'バケツの穴問題',
      penalty: -6,
      description: '新規獲得偏重で既存顧客がザル落ち。顧客獲得コストが無駄遣い状態',
    })
  }

  if (has('finance') && scores.finance < 30) {
    penalties.push({
      name: '財務基盤の脆弱性',
      penalty: -5,
      description: '売上停滞・薄利・顧客集中のいずれかが深刻。事業継続性にリスク',
    })
  }

  if (has('strategy') && scores.strategy < 30) {
    penalties.push({
      name: '戦略不在',
      penalty: -4,
      description: '差別化戦略がなく価格競争に巻き込まれるリスクが高い',
    })
  }

  if (has('sales') && has('customer') && scores.sales > 60 && scores.customer < 30) {
    penalties.push({
      name: '焼畑営業リスク',
      penalty: -5,
      description: '成約率は高いが顧客維持が弱い。一度きりの取引で終わる構造',
    })
  }

  return penalties
}

// --- 5e. リスク指数（0-100, 高い=危険）---
function calculateRiskIndex(answers: Record<string, string | string[]>): number {
  let risk = 0

  const riskMap: Record<string, Record<string, number>> = {
    customerConcentration: { '1社依存': 30, '上位3社で過半': 20, 'やや集中': 8 },
    growthTrend: { '大幅減少': 28, 'やや減少': 15, '横ばい': 5 },
    profitMargin: { '赤字': 22, '薄利': 12 },
    hiringDifficulty: { '非常に困難': 15, 'やや困難': 8 },
    visionAlignment: { '未策定': 10, '経営層のみ': 5 },
  }

  for (const [qId, mapping] of Object.entries(riskMap)) {
    const val = answers[qId] as string
    if (val && mapping[val]) risk += mapping[val]
  }

  // 複合リスク加算: 赤字 + 減少のダブルパンチ
  if (answers.profitMargin === '赤字' && (answers.growthTrend === '大幅減少' || answers.growthTrend === 'やや減少')) {
    risk += 10
  }

  return Math.min(100, risk)
}

// --- 5f. DX成熟度指数 ---
function calculateDXIndex(answers: Record<string, string | string[]>): number {
  let score = 0
  const tools = answers.toolsUsed
  if (Array.isArray(tools)) {
    const valid = tools.filter((t) => t !== '特になし')
    score += Math.min(30, valid.length * 7)
    if (valid.includes('AI/自動化ツール')) score += 10
    if (valid.includes('MA（マーケ自動化）')) score += 8
    if (valid.includes('CRM/SFA')) score += 5
  }

  const autoMap: Record<string, number> = { 'ほぼ手作業': 0, '一部自動化': 8, '主要業務を自動化': 20, '全体最適化': 30, 'AI活用自動化': 38 }
  const dataMap: Record<string, number> = { 'バラバラ管理': 0, '一部統合': 5, 'ダッシュボードあり': 12, 'リアルタイム可視化': 20, '予測分析可能': 27 }

  score += autoMap[answers.automationLevel as string] || 0
  score += dataMap[answers.dataAccess as string] || 0

  return Math.min(100, score)
}

// --- 5g. 成長ポテンシャル ---
function calculateGrowthPotential(
  categoryScores: Record<string, number>,
  riskIndex: number,
  dxIndex: number
): number {
  const factors = [
    (categoryScores.marketing || 40) * 0.22,
    dxIndex * 0.22,
    (categoryScores.strategy || 40) * 0.18,
    (categoryScores.sales || 40) * 0.18,
    (categoryScores.finance || 40) * 0.20,
  ]
  const base = factors.reduce((a, b) => a + b, 0)
  const riskDampen = riskIndex * 0.25
  return Math.max(0, Math.min(100, Math.round(base - riskDampen)))
}

// --- 5h. 収益効率スコア（一人あたり売上 vs 業界ベンチマーク）---
function calculateEfficiencyScore(answers: Record<string, string | string[]>): number {
  const revenueMap: Record<string, number> = {
    '〜1,000万円': 700, '〜5,000万円': 3000, '〜1億円': 7500,
    '〜5億円': 25000, '〜10億円': 75000, '10億以上': 200000,
  }
  const employeeMap: Record<string, number> = {
    '1人（個人）': 1, '2〜5人': 3.5, '6〜20人': 13,
    '21〜50人': 35, '51〜100人': 75, '101〜300人': 200, '300人以上': 500,
  }
  const industryBenchmark: Record<string, number> = {
    'IT/SaaS': 1200, 'EC/通販': 800, '飲食/フード': 400, '不動産': 1500,
    '教育/スクール': 600, '医療/ヘルスケア': 800, '製造/メーカー': 700,
    '士業/コンサル': 1000, '美容/サロン': 350, '人材/HR': 900,
    '金融/保険': 1500, '広告/メディア': 900, 'その他': 700,
  }

  const rev = revenueMap[answers.revenueScale as string] || 3000
  const emp = employeeMap[answers.employeeCount as string] || 10
  const perEmp = rev / emp
  const bench = industryBenchmark[answers.industry as string] || 700
  const ratio = perEmp / bench

  if (ratio >= 1.8) return 92
  if (ratio >= 1.5) return 80
  if (ratio >= 1.2) return 68
  if (ratio >= 1.0) return 55
  if (ratio >= 0.8) return 42
  if (ratio >= 0.6) return 28
  return 15
}

// --- 5i. Webサイト乖離度（自己評価 vs 実態）---
function calculateCredibilityGap(
  selfScores: Record<string, number>,
  ws: WebsiteAnalysis | null
): number {
  if (!ws) return 0
  const selfMarketing = selfScores.marketing || 0
  const gap = selfMarketing - ws.totalScore
  if (gap > 40) return -15
  if (gap > 30) return -10
  if (gap > 20) return -5
  return 0
}

// --- 5j. 最終リアリティスコア ---
function calculateFinalScore(
  categoryScores: Record<string, number>,
  selectedCategories: string[],
  synergyPenalties: SynergyPenalty[],
  ws: WebsiteAnalysis | null,
  riskIndex: number,
): number {
  let totalW = 0, wSum = 0
  for (const id of selectedCategories) {
    const w = CATEGORY_WEIGHTS[id] || 0
    wSum += (categoryScores[id] || 0) * w
    totalW += w
  }
  let base = totalW > 0 ? wSum / totalW : 0

  // シナジーペナルティ
  base += synergyPenalties.reduce((s, p) => s + p.penalty, 0)

  // Webサイト乖離補正
  base += calculateCredibilityGap(categoryScores, ws)

  // リスク減衰
  if (riskIndex > 60) base -= 10
  else if (riskIndex > 40) base -= 5
  else if (riskIndex > 25) base -= 2

  // Webサイト品質がかなり低い場合
  if (ws && ws.totalScore < 25) base -= 5

  return Math.max(0, Math.min(100, Math.round(base)))
}

function scoreToGrade(score: number): string {
  if (score >= 82) return 'S'
  if (score >= 68) return 'A'
  if (score >= 52) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

// =============================================
// 6. Gemini API
// =============================================
async function geminiGenerateJson<T>(prompt: string, maxTokens = 6144): Promise<T> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured')
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError: Error | null = null
  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
        }),
      })
      if (!res.ok) { lastError = new Error(`Gemini ${model}: ${res.status}`); continue }
      const data = await res.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) { lastError = new Error(`Gemini ${model}: empty`); continue }
      return JSON.parse(repairJson(rawText)) as T
    } catch (e: any) { lastError = e; continue }
  }
  throw lastError || new Error('All Gemini models failed')
}

// =============================================
// 6b. AI競合自動発見
// =============================================
interface DiscoveredCompetitor {
  url: string
  name: string
  reason: string
  threatLevel: 'high' | 'medium' | 'low'
}

async function discoverCompetitors(
  industry: string,
  websiteUrl: string | undefined,
  answers: Record<string, string | string[]>,
): Promise<DiscoveredCompetitor[]> {
  const context = [
    `業種: ${industry}`,
    answers.revenueScale ? `売上規模: ${answers.revenueScale}` : '',
    answers.employeeCount ? `従業員数: ${answers.employeeCount}` : '',
    answers.priorityGoal ? `成長目標: ${answers.priorityGoal}` : '',
    websiteUrl ? `自社URL: ${websiteUrl}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `あなたは日本のビジネス競合分析の専門家です。
以下の企業情報から、この企業の直接的な競合となりうる日本企業のWebサイトURLを5つ推測してください。

${context}

条件:
- 実在する日本企業のURLのみ（.co.jp, .jp, .com のドメイン）
- 同業種・同規模で市場が重なる企業を優先
- 大手〜中堅の知名度がある企業を含める（クロール可能なURL）
- ${websiteUrl ? 'この企業のサイトと同じ市場で競合するサイトを選ぶ' : '業種から推測される代表的な競合を選ぶ'}

以下のJSON形式で返してください:
{
  "competitors": [
    { "url": "https://example.co.jp", "name": "企業名", "reason": "なぜ競合か（1文）", "threatLevel": "high" },
    { "url": "https://example2.jp", "name": "企業名2", "reason": "理由", "threatLevel": "medium" }
  ]
}

threatLevel: high=直接競合、medium=間接競合、low=潜在的競合`

  try {
    const result = await geminiGenerateJson<{ competitors: DiscoveredCompetitor[] }>(prompt, 2048)
    return (result.competitors || [])
      .filter((c) => c.url && c.url.startsWith('http'))
      .slice(0, 5)
  } catch {
    return []
  }
}

// =============================================
// 6c. 成長予測・リスクタイムライン算出
// =============================================
interface GrowthForecast {
  current: number
  month3: number
  month6: number
  month12: number
  bestCase12: number
  worstCase12: number
}

function calculateGrowthForecast(
  overallScore: number,
  riskIndex: number,
  growthPotential: number,
  answers: Record<string, string | string[]>,
): GrowthForecast {
  const trend = answers.growthTrend as string
  const trendFactor = trend === '急成長' ? 1.15 : trend === '成長中' ? 1.08 : trend === '横ばい' ? 1.0
    : trend === 'やや減少' ? 0.92 : 0.82

  // 自然減衰 or 自然成長（何もしなかった場合）
  const natural3 = Math.round(overallScore * (trendFactor > 1 ? 1.02 : 0.97))
  const natural6 = Math.round(overallScore * (trendFactor > 1 ? 1.03 : 0.93))
  const natural12 = Math.round(overallScore * (trendFactor > 1 ? 1.05 : 0.85))

  // ベストケース: 改善施策を全実行した場合
  const improvementCeiling = Math.min(40, growthPotential * 0.5)
  const best12 = Math.min(100, Math.round(overallScore + improvementCeiling))

  // ワーストケース: リスクが全て顕在化した場合
  const riskDrop = Math.round(riskIndex * 0.4)
  const worst12 = Math.max(0, Math.round(overallScore - riskDrop))

  return {
    current: overallScore,
    month3: Math.max(0, Math.min(100, natural3)),
    month6: Math.max(0, Math.min(100, natural6)),
    month12: Math.max(0, Math.min(100, natural12)),
    bestCase12: best12,
    worstCase12: worst12,
  }
}

interface RiskTimelineItem {
  risk: string
  severity: 'critical' | 'warning' | 'watch'
  deadline: string
  description: string
}

function calculateRiskTimeline(
  answers: Record<string, string | string[]>,
  categoryScores: Record<string, number>,
  riskIndex: number,
): RiskTimelineItem[] {
  const timeline: RiskTimelineItem[] = []

  if (answers.customerConcentration === '1社依存') {
    timeline.push({ risk: '売上集中リスク', severity: 'critical', deadline: '即時',
      description: '主要顧客1社の取引停止で売上の過半が消失。新規顧客開拓が急務' })
  } else if (answers.customerConcentration === '上位3社で過半') {
    timeline.push({ risk: '顧客集中リスク', severity: 'warning', deadline: '6ヶ月以内',
      description: '上位顧客への依存が高く、値下げ圧力や取引条件変更に弱い' })
  }

  if (answers.profitMargin === '赤字') {
    timeline.push({ risk: '資金ショートリスク', severity: 'critical', deadline: '3ヶ月以内',
      description: '赤字体質が続くとキャッシュフロー枯渇。早急なコスト構造改革が必要' })
  }

  if (answers.growthTrend === '大幅減少') {
    timeline.push({ risk: '市場退出リスク', severity: 'critical', deadline: '6ヶ月以内',
      description: '売上大幅減少のトレンドが継続すれば事業存続が困難に' })
  }

  if ((categoryScores.digital || 100) < 25) {
    timeline.push({ risk: 'DX遅延による競争力喪失', severity: 'warning', deadline: '1年以内',
      description: '競合のデジタル化が進む中、手作業中心の業務が生産性格差を拡大' })
  }

  if ((categoryScores.marketing || 100) < 30) {
    timeline.push({ risk: 'リード枯渇', severity: 'warning', deadline: '6ヶ月以内',
      description: '集客チャネルが脆弱で新規リードが減少傾向。パイプラインが枯渇するリスク' })
  }

  if ((categoryScores.organization || 100) < 30) {
    timeline.push({ risk: 'キーマン退職リスク', severity: 'warning', deadline: '1年以内',
      description: '組織体制が未整備で属人化が進行。キーマン離脱で事業に深刻な影響' })
  }

  if (answers.hiringDifficulty === '非常に困難') {
    timeline.push({ risk: '人材確保困難', severity: 'warning', deadline: '継続',
      description: '採用市場の競争激化で必要人材の確保がさらに困難に' })
  }

  if ((categoryScores.customer || 100) < 30 && (categoryScores.marketing || 0) > 50) {
    timeline.push({ risk: 'LTV悪化', severity: 'watch', deadline: '1年以内',
      description: '新規偏重で顧客離反率が高い。CAC回収前に解約が発生するリスク' })
  }

  if (riskIndex > 60) {
    timeline.push({ risk: '複合リスク連鎖', severity: 'critical', deadline: '即時',
      description: '複数のリスク要因が相互作用し、連鎖的に経営を圧迫する可能性' })
  }

  return timeline.sort((a, b) => {
    const order = { critical: 0, warning: 1, watch: 2 }
    return order[a.severity] - order[b.severity]
  })
}

// =============================================
// 6d. 投資優先度マトリクス算出
// =============================================
interface InvestmentPriority {
  area: string
  currentScore: number
  improvementPotential: number
  estimatedROI: string
  difficulty: 'easy' | 'medium' | 'hard'
  recommendation: string
}

function calculateInvestmentPriorities(
  categoryScores: Record<string, number>,
  selectedCategories: string[],
  answers: Record<string, string | string[]>,
): InvestmentPriority[] {
  const priorities: InvestmentPriority[] = []

  const areaConfig: Record<string, { roiMultiplier: number; difficulty: 'easy' | 'medium' | 'hard'; rec: string }> = {
    marketing: { roiMultiplier: 3.5, difficulty: 'medium', rec: 'コンテンツSEO + リスティング広告で月間リード数を3倍に' },
    sales: { roiMultiplier: 4.0, difficulty: 'medium', rec: 'CRM導入 + 営業プロセス標準化で成約率15%改善' },
    customer: { roiMultiplier: 5.0, difficulty: 'easy', rec: 'CS専任配置 + NPS調査でLTV30%向上' },
    organization: { roiMultiplier: 2.0, difficulty: 'hard', rec: '評価制度整備 + 1on1導入で離職率半減' },
    finance: { roiMultiplier: 2.5, difficulty: 'hard', rec: '管理会計導入 + 顧客ポートフォリオ分散' },
    digital: { roiMultiplier: 3.0, difficulty: 'medium', rec: 'RPA/AIツール導入で工数30%削減' },
    strategy: { roiMultiplier: 2.0, difficulty: 'hard', rec: '3C分析→差別化戦略の明文化→全社浸透' },
  }

  for (const catId of selectedCategories) {
    const score = categoryScores[catId] || 50
    const config = areaConfig[catId]
    if (!config) continue

    const gap = 100 - score
    const potential = Math.round(gap * 0.6) // 実現可能な改善幅
    const roiEstimate = score < 30 ? `${Math.round(config.roiMultiplier * 1.5)}倍`
      : score < 50 ? `${config.roiMultiplier}倍`
      : `${Math.round(config.roiMultiplier * 0.7)}倍`

    priorities.push({
      area: CATEGORY_LABELS[catId],
      currentScore: score,
      improvementPotential: potential,
      estimatedROI: roiEstimate,
      difficulty: score < 20 ? 'easy' : config.difficulty, // スコアが極端に低い = 基礎が未整備 = 改善しやすい
      recommendation: config.rec,
    })
  }

  // 改善ポテンシャル × ROI倍率でソート
  return priorities.sort((a, b) => b.improvementPotential - a.improvementPotential)
}

// =============================================
// 6e. WebsiteAnalysis → フロントエンド用フォーマット変換
// =============================================
function websiteToFrontend(ws: WebsiteAnalysis) {
  return {
    url: ws.url,
    seoScore: ws.seoScore,
    contentScore: ws.contentScore,
    technicalScore: ws.technicalScore,
    totalScore: ws.totalScore,
    issues: ws.issues,
    positives: ws.positives,
    pagesCrawled: ws.pagesCrawled,
    socialLinks: ws.socialLinks,
    hasBlog: ws.hasBlog,
    hasForm: ws.hasForm,
    hasSchema: ws.hasSchema,
    ogImage: ws.ogImage,
    meta: {
      title: ws.meta.title || '',
      description: ws.meta.description || ws.meta['og:description'] || '',
    },
    headings: ws.headings.slice(0, 20),
    textLength: ws.textLength,
    imageStats: ws.imageStats,
  }
}

// =============================================
// 7. プロンプト生成
// =============================================
function fmt(val: string | string[] | undefined): string {
  if (!val) return '未回答'
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '未回答'
  return val
}

const CATEGORY_ANSWER_SECTIONS: Record<string, (a: Record<string, string | string[]>) => string> = {
  marketing: (a) => `■ 集客・マーケティング
- 主な集客チャネル: ${fmt(a.channels)}
- 月間リード獲得数: ${fmt(a.leadCount)}
- マーケティング効果測定: ${fmt(a.measurementMaturity)}
- コンテンツマーケティング: ${fmt(a.contentMarketing)}`,
  sales: (a) => `■ 営業・商談プロセス
- 商談成約率: ${fmt(a.closeRate)}
- 営業プロセス標準化: ${fmt(a.salesProcess)}
- 商談リードタイム: ${fmt(a.leadTime)}
- データ営業分析: ${fmt(a.salesAnalysis)}`,
  customer: (a) => `■ 顧客対応・リテンション
- リピート率: ${fmt(a.repeatRate)}
- フィードバック収集: ${fmt(a.feedbackCollection)}
- アフターフォロー: ${fmt(a.afterFollow)}`,
  organization: (a) => `■ 組織・人材
- 採用の課題度: ${fmt(a.hiringDifficulty)}
- 役割・責任の明確さ: ${fmt(a.roleClarity)}
- 教育・研修制度: ${fmt(a.training)}
- ビジョン浸透度: ${fmt(a.visionAlignment)}`,
  finance: (a) => `■ 財務・収益構造
- 売上成長トレンド: ${fmt(a.growthTrend)}
- 利益率: ${fmt(a.profitMargin)}
- 顧客集中度: ${fmt(a.customerConcentration)}`,
  digital: (a) => `■ デジタル・業務効率化
- 利用ツール: ${fmt(a.toolsUsed)}
- 業務自動化レベル: ${fmt(a.automationLevel)}
- データアクセス性: ${fmt(a.dataAccess)}`,
  strategy: (a) => `■ 経営戦略・成長投資
- 最優先の成長目標: ${fmt(a.priorityGoal)}
- 最大の成長障壁: ${fmt(a.growthObstacle)}
- 競争優位性: ${fmt(a.competitiveAdvantage)}`,
}

function buildPrompt(
  answers: Record<string, string | string[]>,
  selectedCategories: string[],
  categoryScores: Record<string, number>,
  overallScore: number,
  grade: string,
  synergyPenalties: SynergyPenalty[],
  riskIndex: number,
  dxIndex: number,
  growthPotential: number,
  efficiencyScore: number,
  ws: WebsiteAnalysis | null,
  competitorAnalyses: WebsiteAnalysis[],
): string {
  const scoreLines = selectedCategories
    .map((id) => `- ${CATEGORY_LABELS[id]}: ${categoryScores[id]}/100`)
    .join('\n')

  const answerSections = selectedCategories
    .map((id) => CATEGORY_ANSWER_SECTIONS[id]?.(answers) || '')
    .filter(Boolean)
    .join('\n\n')

  const penaltyLines = synergyPenalties.length > 0
    ? synergyPenalties.map((p) => `- ${p.name}: ${p.penalty}pt（${p.description}）`).join('\n')
    : '- なし'

  let websiteSection = ''
  if (ws) {
    websiteSection = `
【Webサイト分析結果（自動クロール）】
URL: ${ws.url}
- SEOスコア: ${ws.seoScore}/100
- コンテンツスコア: ${ws.contentScore}/100
- テクニカルスコア: ${ws.technicalScore}/100
- 総合サイトスコア: ${ws.totalScore}/100
- クロールページ数: ${ws.pagesCrawled}
- テキスト量: ${Math.round(ws.textLength / 1000)}K文字
- ブログ有無: ${ws.hasBlog ? 'あり' : 'なし'}
- CTA/フォーム: ${ws.hasForm ? 'あり' : 'なし'}
- 構造化データ: ${ws.hasSchema ? 'あり' : 'なし'}
- SNS連携: ${ws.socialLinks.length > 0 ? ws.socialLinks.join(', ') : 'なし'}
- 検出された問題点:
${ws.issues.map((i) => `  ❌ ${i}`).join('\n')}
- サイト本文抜粋（最初の2000文字）:
${ws.textExcerpt.slice(0, 2000)}`
  }

  let competitorSection = ''
  if (competitorAnalyses.length > 0) {
    competitorSection = '\n【競合サイト分析結果】\n' + competitorAnalyses.map((c, i) => `
[競合${i + 1}] ${c.url}
- SEO: ${c.seoScore}/100, コンテンツ: ${c.contentScore}/100, 技術: ${c.technicalScore}/100, 総合: ${c.totalScore}/100
- ブログ: ${c.hasBlog ? 'あり' : 'なし'}, CTA: ${c.hasForm ? 'あり' : 'なし'}, SNS: ${c.socialLinks.join(', ') || 'なし'}
- 見出し: ${c.headings.slice(0, 5).join(' / ')}
- 問題点: ${c.issues.slice(0, 3).join('; ')}`).join('\n')
  }

  const axesLabels = selectedCategories.map((id) => CATEGORY_LABELS[id])

  return `あなたは日本トップクラスの辛口経営コンサルタントであり、データアナリスト・マーケティング戦略家・財務アドバイザーを兼ねています。
以下のルールを厳守してください:
1. お世辞は一切不要。問題点は容赦なく指摘すること
2. 「頑張っている」「素晴らしい」などの褒め言葉は禁止。事実と数字だけで語ること
3. スコアが低い項目は「致命的」「危険水域」「早急に対応が必要」などの強い表現を使うこと
4. 業界の統計データや一般的なベンチマークを引用して論拠を示すこと（例: 「同業種の平均成約率は25%だが…」）
5. 自己評価とWebサイトの実態に乖離がある場合は「自己評価が甘い」と明確に指摘すること
6. 競合情報がある場合は「競合はすでにやっている」と比較して危機感を煽ること
7. 各項目で「具体的な数字」「業界統計」「一般的なKPI基準」を必ず引用すること
8. 推測や予測には必ず根拠を添えること

【企業プロフィール】
- 業種: ${fmt(answers.industry)}
- 年間売上規模: ${fmt(answers.revenueScale)}
- 従業員数: ${fmt(answers.employeeCount)}
- 創業年数: ${fmt(answers.companyAge)}

【サーバーサイド算出スコア（計算式による厳格採点）】
${scoreLines}
- ★総合リアリティスコア: ${overallScore}/100 (グレード: ${grade})

【検出されたクロスカテゴリ・ペナルティ】
${penaltyLines}

【算出リスク指標】
- 事業リスク指数: ${riskIndex}/100 ${riskIndex > 50 ? '⚠️ 危険水域' : riskIndex > 30 ? '⚡ 要注意' : '✓ 許容範囲'}
- DX成熟度: ${dxIndex}/100 ${dxIndex < 30 ? '⚠️ DX後進' : dxIndex < 50 ? '△ 発展途上' : '○ 進行中'}
- 成長ポテンシャル: ${growthPotential}/100
- 収益効率（一人あたり売上/業界比）: ${efficiencyScore}/100

【具体的な回答内容】
${answerSections}
${websiteSection}
${competitorSection}

以下のJSON形式で返してください。スコアはすでに算出済みなので、axesのscoreには手を加えないでください。commentだけ記入してください。

{
  "summary": "<辛口の総合診断。最初に最大の問題点を述べ、このまま改善しないとどうなるかを具体的数字で警告。4-5文。例:「現在の成約率10%は業界平均の25%を大幅に下回り…」>",
  "executiveSummary": "<経営者向けの超要約。3つの最重要課題と、今すぐやるべき1つのアクション。2-3文。>",
  "axesComments": {
${axesLabels.map((l) => `    "${l}": "<${l}について辛口に評価。業界平均との数値比較、競合との差、このままのリスク予測を含む。3-4文。>"`).join(',\n')}
  },
  "strengths": [
    { "title": "<強み1>", "description": "<回答・データから特定された事実ベースの強み。競合との差別化にどう活かせるかも言及>", "leverageAdvice": "<この強みを最大活用するための具体的施策>" },
    { "title": "<強み2>", "description": "<説明>", "leverageAdvice": "<活用施策>" },
    { "title": "<強み3>", "description": "<説明>", "leverageAdvice": "<活用施策>" }
  ],
  "bottlenecks": [
    { "title": "<ボトルネック1>", "description": "<最重要の問題。具体的にどう致命的か。業界データを引用>", "severity": "high", "impact": "<このまま放置すると起きる最悪のシナリオ。具体的な数字で>", "estimatedLoss": "<放置した場合の推定損失額・機会損失>" },
    { "title": "<ボトルネック2>", "description": "<説明>", "severity": "high", "impact": "<影響>", "estimatedLoss": "<損失>" },
    { "title": "<ボトルネック3>", "description": "<説明>", "severity": "high", "impact": "<影響>", "estimatedLoss": "<損失>" },
    { "title": "<ボトルネック4>", "description": "<説明>", "severity": "medium", "impact": "<影響>", "estimatedLoss": "<損失>" },
    { "title": "<ボトルネック5>", "description": "<説明>", "severity": "medium", "impact": "<影響>", "estimatedLoss": "<損失>" },
    { "title": "<ボトルネック6>", "description": "<説明>", "severity": "low", "impact": "<影響>", "estimatedLoss": "<損失>" },
    { "title": "<ボトルネック7>", "description": "<説明>", "severity": "low", "impact": "<影響>", "estimatedLoss": "<損失>" }
  ],
  "recommendations": [
    { "title": "<アクション1>", "description": "<具体的な施策。ツール名・手法名・導入ステップを含む。例:「1. HubSpot CRM無料版を導入 2. 商談パイプラインを設定 3. 週次レビューを開始」>", "priority": "high", "estimatedCost": "<月額XX万円〜>", "estimatedEffect": "<XX%改善見込み（根拠: 業界統計）>", "timeframe": "<期間>", "quickWin": true },
    { "title": "<アクション2>", "description": "<施策>", "priority": "high", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false },
    { "title": "<アクション3>", "description": "<施策>", "priority": "high", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false },
    { "title": "<アクション4>", "description": "<施策>", "priority": "medium", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false },
    { "title": "<アクション5>", "description": "<施策>", "priority": "medium", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false },
    { "title": "<アクション6>", "description": "<施策>", "priority": "low", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false },
    { "title": "<アクション7>", "description": "<施策>", "priority": "low", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>", "quickWin": false }
  ],
  "benchmarkAverages": {
${axesLabels.map((l) => `    "${l}": <日本の同業種・同規模における平均スコア（厳しめに設定）>`).join(',\n')}
  },
  "industryInsights": [
    "<この業種特有のトレンドや課題に関する洞察1（統計データ引用）>",
    "<業界動向2>",
    "<業界動向3>"
  ],
  "competitorIntelligence": "<競合分析サマリー。サイトクロール結果を踏まえ、競合が実施していて自社が未実施の施策を具体的に列挙。3-4文。>",
  "immediateActions": [
    "<今週中にやるべきこと1（無料で今すぐできる施策）>",
    "<今週中にやるべきこと2>",
    "<今週中にやるべきこと3>"
  ]
}

重要:
- summaryは必ず具体的数字を含めること（「成約率が業界平均の半分」等）
- bottlenecksは必ず7件。severityのhighを最低3件入れる
- recommendationsは必ず7件。quickWin=trueは1-2件（今すぐ低コストで始められるもの）
- estimatedLossは「年間○○万円の機会損失」のように具体的金額で記述
- industryInsightsは業界の最新トレンド・統計を引用
- competitorIntelligenceは競合サイトの分析結果がある場合はそれを参照
- immediateActionsは「無料」「今週中」「1人でできる」レベルの即効施策
- JSONのみ返すこと`
}

// =============================================
// 8. POST ハンドラ（SSE ストリーミング版）
// =============================================
export async function POST(req: NextRequest) {
  // --- バリデーション（エラー時は通常JSON応答で返す）---
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの解析に失敗しました' }, { status: 400 })
  }

  const { answers, selectedCategories, websiteUrl, competitorUrls } = body as {
    answers: Record<string, string | string[]>
    selectedCategories: string[]
    websiteUrl?: string
    competitorUrls?: string[]
  }

  if (!answers || !answers.industry) {
    return NextResponse.json({ error: '業種は必須です' }, { status: 400 })
  }
  if (!selectedCategories || selectedCategories.length === 0) {
    return NextResponse.json({ error: '診断項目を1つ以上選択してください' }, { status: 400 })
  }

  // --- 認証 + 回数制限（ストリーム開始前に処理）---
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user?.id

  if (isLoggedIn) {
    const user = session.user as any
    const isFreeHour = isWithinFreeHour(user.firstLoginAt)
    if (!isFreeHour) {
      const dailyLimit = getShindanDailyLimitByUserPlan(user.plan)
      if (dailyLimit !== -1) {
        const sub = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId: user.id, serviceId: 'shindan' } },
        })
        const needsReset = !sub || shouldResetDailyUsage(sub.lastUsageReset)
        const currentUsage = needsReset ? 0 : (sub?.dailyUsage ?? 0)
        if (currentUsage >= dailyLimit) {
          return NextResponse.json(
            { error: `本日の診断上限（${dailyLimit}回）に達しました。明日またご利用ください。` },
            { status: 429 }
          )
        }
        // 使用回数を先にインクリメント（ストリーミング中はCookie/DB更新不可のため）
        const todayJST = new Date(getTodayDateJST())
        await prisma.userServiceSubscription.upsert({
          where: { userId_serviceId: { userId: user.id, serviceId: 'shindan' } },
          update: { dailyUsage: needsReset ? 1 : { increment: 1 }, lastUsageReset: needsReset ? todayJST : undefined },
          create: { userId: user.id, serviceId: 'shindan', plan: 'FREE', dailyUsage: 1, lastUsageReset: todayJST },
        })
      }
    }
  }
  // ゲスト回数制限: ストリーミング応答ではCookie設定不可のためスキップ

  // --- SSE ストリーム開始 ---
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      /** SSEイベント送信ヘルパー */
      function sendEvent(event: string, data: any) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        // ========== A. 多次元スコアリング ==========
        const categoryScores: Record<string, number> = {}
        for (const catId of selectedCategories) {
          categoryScores[catId] = weightedCategoryScore(catId, answers)
        }

        const synergyPenalties = calculateSynergyPenalties(categoryScores)
        const riskIndex = calculateRiskIndex(answers)
        const dxIndex = selectedCategories.includes('digital') ? calculateDXIndex(answers) : -1
        const growthPotential = calculateGrowthPotential(categoryScores, riskIndex, dxIndex >= 0 ? dxIndex : 30)
        const efficiencyScore = calculateEfficiencyScore(answers)

        // >>> SSE: scoring イベント送信
        sendEvent('scoring', {
          categoryScores,
          synergyPenalties,
          riskIndex,
          dxMaturity: dxIndex,
          growthPotential,
          efficiencyScore,
        })

        // ========== B. Webサイト深掘り分析 + 競合自動発見（並列開始）==========
        const [wsResult, discoveredResult] = await Promise.all([
          websiteUrl ? analyzeWebsite(websiteUrl) : Promise.resolve(null),
          discoverCompetitors(answers.industry as string, websiteUrl, answers),
        ])
        const websiteAnalysis = wsResult
        const discoveredCompetitorList = discoveredResult

        // >>> SSE: website イベント送信
        sendEvent('website', {
          websiteHealth: websiteAnalysis ? websiteToFrontend(websiteAnalysis) : null,
        })

        // >>> SSE: discovery イベント送信
        sendEvent('discovery', {
          discoveredCompetitors: discoveredCompetitorList,
        })

        // ========== C. 競合サイト分析（手動入力 + AI発見 を統合して並列クロール）==========
        const competitorAnalyses: WebsiteAnalysis[] = []
        const manualUrls = (competitorUrls || []).filter((u: string) => u && u.startsWith('http')).slice(0, 3)
        const discoveredUrls = discoveredCompetitorList.map((c) => c.url)
        const allCompetitorUrls = [...new Set([...manualUrls, ...discoveredUrls])].slice(0, 5)

        if (allCompetitorUrls.length > 0) {
          const results = await Promise.all(allCompetitorUrls.map((u: string) => analyzeWebsite(u)))
          for (const r of results) {
            if (r) competitorAnalyses.push(r)
          }
        }

        // >>> SSE: competitors イベント送信
        sendEvent('competitors', {
          competitorComparison: competitorAnalyses.map((c) => websiteToFrontend(c)),
        })

        // ========== D. 最終スコア算出 ==========
        const overallScore = calculateFinalScore(
          categoryScores, selectedCategories, synergyPenalties, websiteAnalysis, riskIndex
        )
        const grade = scoreToGrade(overallScore)

        // ========== D2. 追加分析指標 ==========
        const growthForecast = calculateGrowthForecast(overallScore, riskIndex, growthPotential, answers)
        const riskTimeline = calculateRiskTimeline(answers, categoryScores, riskIndex)
        const investmentPriorities = calculateInvestmentPriorities(categoryScores, selectedCategories, answers)
        const credibilityGap = calculateCredibilityGap(categoryScores, websiteAnalysis)

        // >>> SSE: scores イベント送信
        sendEvent('scores', {
          overallScore,
          overallGrade: grade,
          growthForecast,
          riskTimeline,
          investmentPriorities,
          credibilityGap,
        })

        // ========== E. Gemini辛口診断（超詳細版）==========
        const prompt = buildPrompt(
          answers, selectedCategories, categoryScores, overallScore, grade,
          synergyPenalties, riskIndex, dxIndex, growthPotential, efficiencyScore,
          websiteAnalysis, competitorAnalyses,
        )
        const geminiResult = await geminiGenerateJson<any>(prompt, 8192)

        // ========== F. 結果マージ ==========
        const axesComments = geminiResult.axesComments || {}
        const benchmarkAvgs = geminiResult.benchmarkAverages || {}

        const result = {
          overallScore,
          overallGrade: grade,
          summary: geminiResult.summary || '',
          executiveSummary: geminiResult.executiveSummary || '',
          axes: selectedCategories.map((id) => ({
            label: CATEGORY_LABELS[id],
            score: categoryScores[id],
            comment: axesComments[CATEGORY_LABELS[id]] || '',
          })),
          strengths: (geminiResult.strengths || []).map((s: any) => ({
            title: s.title || '',
            description: s.description || '',
            score: categoryScores[selectedCategories[0]] || 50,
            leverageAdvice: s.leverageAdvice || '',
          })),
          bottlenecks: (geminiResult.bottlenecks || []).map((b: any) => ({
            ...b,
            estimatedLoss: b.estimatedLoss || '',
          })),
          recommendations: (geminiResult.recommendations || []).map((r: any) => ({
            ...r,
            quickWin: r.quickWin || false,
          })),
          benchmark: selectedCategories.map((id) => ({
            category: CATEGORY_LABELS[id],
            yourScore: categoryScores[id],
            industryAverage: benchmarkAvgs[CATEGORY_LABELS[id]] || 50,
          })),
          industryInsights: geminiResult.industryInsights || [],
          competitorIntelligence: geminiResult.competitorIntelligence || '',
          immediateActions: geminiResult.immediateActions || [],
          analytics: {
            categoryScores,
            synergyPenalties,
            riskIndex,
            dxMaturity: dxIndex,
            growthPotential,
            efficiencyScore,
            websiteHealth: websiteAnalysis ? websiteToFrontend(websiteAnalysis) : null,
            credibilityGap,
            competitorComparison: competitorAnalyses.map((c) => websiteToFrontend(c)),
            discoveredCompetitors: discoveredCompetitorList,
            growthForecast,
            riskTimeline,
            investmentPriorities,
          },
        }

        // >>> SSE: complete イベント送信
        sendEvent('complete', { result })

      } catch (err: any) {
        console.error('[shindan/generate] SSE Error:', err)
        // >>> SSE: error イベント送信
        const payload = `event: error\ndata: ${JSON.stringify({ error: err?.message || '診断に失敗しました。もう一度お試しください。' })}\n\n`
        controller.enqueue(encoder.encode(payload))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
