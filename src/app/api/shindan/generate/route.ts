// ========================================
// ドヤWebサイト診断AI - Webサイト競合分析API
// Web7軸スコアリング + 競合サイト深掘り + 辛口AI診断
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
  // --- 拡張分析フィールド（後方互換のためオプショナル）---
  tracking?: {
    hasGA4: boolean; hasGTM: boolean; hasGoogleAds: boolean; hasFBPixel: boolean
    hasLinkedInInsight: boolean; hasHotjar: boolean; hasClarityMs: boolean
    hasHubspot: boolean; hasPardot: boolean; hasMarketo: boolean
    detectedTools: string[]; maturityLevel: 'none' | 'basic' | 'intermediate' | 'advanced'; trackingScore: number
  }
  appealAxis?: {
    heroText: string; heroType: 'benefit' | 'feature' | 'emotional' | 'social-proof' | 'unclear'
    valueProposition: string; uspKeywords: string[]; benefitStatements: string[]
    featureStatements: string[]; emotionalTriggers: string[]; appealScore: number
  }
  socialProof?: {
    hasTestimonials: boolean; hasClientLogos: boolean; hasCaseStudies: boolean
    hasCertifications: boolean; hasUserCount: boolean; hasMediaMentions: boolean; hasAwards: boolean
    userCountText: string | null; proofElements: string[]; socialProofScore: number
  }
  ctaAnalysis?: {
    ctaTexts: string[]; ctaCount: number; hasLeadMagnet: boolean; hasLiveChat: boolean
    hasPopup: boolean; ctaPlacement: 'hero-only' | 'distributed' | 'footer-only' | 'none'
    primaryCTA: string | null; ctaEffectivenessScore: number
  }
  pricingSignals?: {
    hasPricingPage: boolean; hasFreeTrial: boolean; hasFreeplan: boolean
    hasMoneyBackGuarantee: boolean; pricingModel: 'visible' | 'hidden' | 'contact-required' | 'none'
    pricingPageUrl: string | null; priceIndicators: string[]; pricingTransparencyScore: number
  }
  contentMarketing?: {
    blogPostIndicators: number; hasResourceCenter: boolean; hasNewsletterSignup: boolean
    hasVideo: boolean; hasWebinar: boolean; hasPodcast: boolean
    contentTypes: string[]; topicClusters: string[]; contentDepthScore: number
  }
  competitivePositioning?: {
    hasComparisonPage: boolean; mentionedCompetitors: string[]; differentiationClaims: string[]
    positioningType: 'leader' | 'challenger' | 'niche' | 'unclear'; positioningScore: number
  }
  discoveredSubdomains?: string[]
  crawledDirectories?: string[]
  responseTimeMs?: number
  securityHeaders?: string[]
  jsFileCount?: number
  cssFileCount?: number
  hasLazyLoading?: boolean
  hasFavicon?: boolean
  redirectChain?: string  // final URL after redirects
  pageSpeed?: PageSpeedData
}

interface PageSpeedData {
  // Lighthouse scores (0-100)
  performanceScore: number
  accessibilityScore: number
  bestPracticesScore: number
  seoScore: number  // Lighthouse's own SEO score
  // Core Web Vitals
  lcp: number | null  // Largest Contentful Paint (ms)
  fcp: number | null  // First Contentful Paint (ms)
  cls: number | null  // Cumulative Layout Shift
  tbt: number | null  // Total Blocking Time (ms, proxy for INP)
  si: number | null   // Speed Index (ms)
  tti: number | null  // Time to Interactive (ms)
  // CrUX real-world data (when available)
  cruxLcp: number | null
  cruxFid: number | null
  cruxCls: number | null
  cruxInp: number | null
  // raw strategy
  strategy: 'mobile' | 'desktop'
}

// =============================================
// 2b. 拡張検出関数群（HTML パターンマッチング）
// =============================================

function detectTracking(html: string) {
  const hasGA4 = /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-|GA_MEASUREMENT_ID/i.test(html)
  const hasGTM = /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i.test(html)
  const hasGoogleAds = /googleads\.g\.doubleclick|google_conversion_id|AW-\d+/i.test(html)
  const hasFBPixel = /fbq\s*\(|facebook\.com\/tr\?|connect\.facebook\.net.*fbevents/i.test(html)
  const hasLinkedInInsight = /snap\.licdn\.com|_linkedin_data_partner_id/i.test(html)
  const hasHotjar = /hotjar\.com|_hjSettings/i.test(html)
  const hasClarityMs = /clarity\.ms/i.test(html)
  const hasHubspot = /js\.hs-scripts\.com|_hsq\s*=/i.test(html)
  const hasPardot = /pardot\.com|pi\.pardot/i.test(html)
  const hasMarketo = /marketo\.com|munchkin/i.test(html)

  const detectedTools: string[] = []
  if (hasGA4) detectedTools.push('GA4')
  if (hasGTM) detectedTools.push('GTM')
  if (hasGoogleAds) detectedTools.push('Google Ads')
  if (hasFBPixel) detectedTools.push('Facebook Pixel')
  if (hasLinkedInInsight) detectedTools.push('LinkedIn Insight')
  if (hasHotjar) detectedTools.push('Hotjar')
  if (hasClarityMs) detectedTools.push('Microsoft Clarity')
  if (hasHubspot) detectedTools.push('HubSpot')
  if (hasPardot) detectedTools.push('Pardot')
  if (hasMarketo) detectedTools.push('Marketo')

  const count = detectedTools.length
  const trackingScore = Math.min(100, count * 15 + (hasGA4 ? 10 : 0) + (hasGTM ? 5 : 0) + ((hasHubspot || hasPardot || hasMarketo) ? 15 : 0))

  const maturityLevel: 'none' | 'basic' | 'intermediate' | 'advanced' =
    count === 0 ? 'none' : count <= 2 ? 'basic' : count <= 4 ? 'intermediate' : 'advanced'

  return {
    hasGA4, hasGTM, hasGoogleAds, hasFBPixel, hasLinkedInInsight,
    hasHotjar, hasClarityMs, hasHubspot, hasPardot, hasMarketo,
    detectedTools, maturityLevel, trackingScore,
  }
}

function detectAppealAxis(html: string, headings: string[], mainText: string) {
  // ヒーローテキスト: 最初のh1タグのコンテンツ
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const heroText = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''

  // バリュープロポジション: h1直後の最初のpタグ
  const afterH1 = h1Match ? html.slice(html.indexOf(h1Match[0]) + h1Match[0].length) : ''
  const firstPMatch = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  const valueProposition = firstPMatch ? firstPMatch[1].replace(/<[^>]+>/g, '').trim() : ''

  const combinedText = heroText + ' ' + valueProposition + ' ' + headings.join(' ')

  // パターンマッチング
  const benefitPattern = /(?:で|が)(?:できる|向上|改善|アップ|削減|効率化|実現|解決|成功)/gi
  const featurePattern = /(?:搭載|対応|機能|スペック|仕様|最新|業界標準)/gi
  const emotionalPattern = /(?:今だけ|限定|残りわずか|急いで|見逃すな|ご安心|信頼|安心|実績No\.1|業界初)/gi
  const uspPattern = /(?:唯一|オンリーワン|独自|特許|日本初|業界初|No\.1|最安|最速|圧倒的)/gi

  const benefitStatements = (mainText.match(benefitPattern) || []).map(s => s)
  const featureStatements = (mainText.match(featurePattern) || []).map(s => s)
  const emotionalTriggers = (mainText.match(emotionalPattern) || []).map(s => s)
  const uspKeywords = (mainText.match(uspPattern) || []).map(s => s)

  // ヒーローテキストのタイプ判定
  let heroType: 'benefit' | 'feature' | 'emotional' | 'social-proof' | 'unclear' = 'unclear'
  if (benefitPattern.test(combinedText)) heroType = 'benefit'
  else if (emotionalPattern.test(combinedText)) heroType = 'emotional'
  else if (/導入実績|お客様の声|利用者/.test(combinedText)) heroType = 'social-proof'
  else if (featurePattern.test(combinedText)) heroType = 'feature'

  const appealScore = Math.min(100,
    (heroText ? 20 : 0) +
    (valueProposition ? 15 : 0) +
    Math.min(25, benefitStatements.length * 5) +
    Math.min(20, uspKeywords.length * 10) +
    Math.min(10, emotionalTriggers.length * 5) +
    (heroType !== 'unclear' ? 10 : 0)
  )

  return {
    heroText, heroType, valueProposition, uspKeywords,
    benefitStatements, featureStatements, emotionalTriggers, appealScore,
  }
}

function detectSocialProof(html: string, mainText: string) {
  const hasTestimonials = /お客様の声|導入実績|ユーザーの声|利用者の声|testimonial|voice|review/i.test(html)
  const hasClientLogos = /導入企業|取引先|パートナー企業|主要取引先|client|partner/i.test(html)
  const hasCaseStudies = /成功事例|導入事例|活用事例|case.?stud/i.test(html)
  const hasCertifications = /認証|認定|ISO|プライバシーマーク|Pマーク/i.test(html)
  const hasMediaMentions = /メディア掲載|取材|掲載実績/i.test(html)
  const hasAwards = /受賞|アワード|award|グランプリ|表彰/i.test(html)

  const userCountMatch = mainText.match(/(?:導入|累計|利用|登録)\s*(?:実績\s*)?[\d,\.]+\s*(?:社|件|名|ユーザー|人|企業|店舗)/i)
  const hasUserCount = !!userCountMatch
  const userCountText = userCountMatch ? userCountMatch[0] : null

  const proofElements: string[] = []
  if (hasTestimonials) proofElements.push('お客様の声')
  if (hasClientLogos) proofElements.push('導入企業ロゴ')
  if (hasCaseStudies) proofElements.push('導入事例')
  if (hasCertifications) proofElements.push('認証・認定')
  if (hasUserCount) proofElements.push('利用実績数')
  if (hasMediaMentions) proofElements.push('メディア掲載')
  if (hasAwards) proofElements.push('受賞歴')

  const socialProofScore = Math.min(100,
    (hasTestimonials ? 20 : 0) + (hasClientLogos ? 15 : 0) + (hasCaseStudies ? 20 : 0) +
    (hasCertifications ? 10 : 0) + (hasUserCount ? 15 : 0) + (hasMediaMentions ? 10 : 0) + (hasAwards ? 10 : 0)
  )

  return {
    hasTestimonials, hasClientLogos, hasCaseStudies, hasCertifications,
    hasUserCount, hasMediaMentions, hasAwards, userCountText, proofElements, socialProofScore,
  }
}

function detectCTADetails(html: string) {
  // CTA要素の抽出（aタグ、buttonタグからCTAキーワードを含むテキストを取得）
  const ctaPattern = /お問い合わせ|資料請求|無料|体験|デモ|申し込み|相談|登録|ダウンロード|見積|トライアル/i
  const ctaTexts: string[] = []

  const linkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRegex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text && ctaPattern.test(text) && text.length < 100) ctaTexts.push(text)
  }
  const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi
  while ((m = btnRegex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text && ctaPattern.test(text) && text.length < 100) ctaTexts.push(text)
  }

  const ctaCount = ctaTexts.length
  const hasLeadMagnet = /ダウンロード|ホワイトペーパー|eBook|資料請求|無料レポート/i.test(html)
  const hasLiveChat = /chat|チャット|intercom|zendesk|crisp|drift|livechat|tawk/i.test(html)
  const hasPopup = /popup|modal|overlay|exit.?intent/i.test(html)

  // CTA配置の判定
  const heroArea = html.slice(0, 5000)
  const footerIndex = html.search(/<footer/i)
  const footerArea = footerIndex >= 0 ? html.slice(footerIndex) : ''
  const heroHasCTA = ctaPattern.test(heroArea)
  const footerHasCTA = ctaPattern.test(footerArea)

  let ctaPlacement: 'hero-only' | 'distributed' | 'footer-only' | 'none' = 'none'
  if (heroHasCTA && footerHasCTA) ctaPlacement = 'distributed'
  else if (heroHasCTA) ctaPlacement = 'hero-only'
  else if (footerHasCTA) ctaPlacement = 'footer-only'

  const primaryCTA = ctaTexts.length > 0 ? ctaTexts[0] : null

  const ctaEffectivenessScore = Math.min(100,
    Math.min(30, ctaCount * 8) +
    (hasLeadMagnet ? 20 : 0) +
    (hasLiveChat ? 15 : 0) +
    (ctaPlacement === 'distributed' ? 25 : ctaPlacement === 'hero-only' ? 15 : ctaPlacement === 'footer-only' ? 5 : 0) +
    (hasPopup ? 10 : 0)
  )

  return {
    ctaTexts: ctaTexts.slice(0, 10), ctaCount, hasLeadMagnet, hasLiveChat,
    hasPopup, ctaPlacement, primaryCTA, ctaEffectivenessScore,
  }
}

function detectPricingSignals(html: string, internalLinks: string[]) {
  const pricingLink = internalLinks.find(l => /pricing|price|料金|プラン|plan/i.test(l))
  const hasPricingPage = !!pricingLink
  const hasFreeTrial = /free.?trial|無料.?(?:トライアル|お試し|体験|期間)/i.test(html)
  const hasFreeplan = /free.?plan|無料プラン|フリープラン|0円/i.test(html)
  const hasMoneyBackGuarantee = /返金保証|money.?back|全額返金/i.test(html)

  // 料金表示モデル判定
  const hasVisiblePrice = /(?:月額|年額|¥|￥)\s*[\d,\.]+/i.test(html)
  const hasContactRequired = /お問い合わせ.*料金|料金.*お問い合わせ|要見積|個別見積/i.test(html)

  let pricingModel: 'visible' | 'hidden' | 'contact-required' | 'none' = 'none'
  if (hasVisiblePrice) pricingModel = 'visible'
  else if (hasContactRequired) pricingModel = 'contact-required'
  else if (hasPricingPage) pricingModel = 'hidden'

  const priceIndicators = (html.match(/(?:月額|年額|¥|￥)\s*[\d,\.]+\s*(?:円|\/月|\/年)?/gi) || []).slice(0, 10)
  const pricingPageUrl = pricingLink || null

  const pricingTransparencyScore = Math.min(100,
    (hasPricingPage ? 25 : 0) +
    (hasVisiblePrice ? 30 : 0) +
    (hasFreeTrial ? 20 : 0) +
    (hasFreeplan ? 10 : 0) +
    (hasMoneyBackGuarantee ? 15 : 0)
  )

  return {
    hasPricingPage, hasFreeTrial, hasFreeplan, hasMoneyBackGuarantee,
    pricingModel, pricingPageUrl, priceIndicators, pricingTransparencyScore,
  }
}

function detectContentMarketing(html: string, internalLinks: string[]) {
  const blogLinks = internalLinks.filter(l => /blog|article|post|column|news/i.test(l))
  const blogPostIndicators = blogLinks.length
  const hasResourceCenter = /リソース|ダウンロード資料|お役立ち|ナレッジ/i.test(html)
  const hasNewsletterSignup = /メルマガ|メールマガジン|購読|subscribe|配信登録/i.test(html)
  const hasVideo = /youtube\.com\/embed|vimeo\.com|動画|ウェビナー/i.test(html)
  const hasWebinar = /ウェビナー|webinar|オンラインセミナー/i.test(html)
  const hasPodcast = /podcast|ポッドキャスト|音声配信/i.test(html)

  const contentTypes: string[] = []
  if (blogPostIndicators > 0) contentTypes.push('ブログ')
  if (hasVideo) contentTypes.push('動画')
  if (hasWebinar) contentTypes.push('ウェビナー')
  if (hasResourceCenter) contentTypes.push('資料DL')
  if (internalLinks.some(l => /news|お知らせ/i.test(l))) contentTypes.push('ニュース')
  if (internalLinks.some(l => /case|事例/i.test(l))) contentTypes.push('事例')

  // トピッククラスター: カテゴリ/タグURLパターンから抽出
  const topicClusters: string[] = []
  for (const link of internalLinks) {
    const catMatch = link.match(/(?:category|tag|topics?)\/([^\/]+)/i)
    if (catMatch && catMatch[1]) {
      const topic = decodeURIComponent(catMatch[1]).replace(/-/g, ' ')
      if (!topicClusters.includes(topic)) topicClusters.push(topic)
    }
  }

  const contentDepthScore = Math.min(100,
    Math.min(30, blogPostIndicators * 5) +
    (hasResourceCenter ? 15 : 0) +
    (hasNewsletterSignup ? 15 : 0) +
    (hasVideo ? 15 : 0) +
    (hasWebinar ? 10 : 0) +
    (hasPodcast ? 5 : 0) +
    Math.min(10, topicClusters.length * 3)
  )

  return {
    blogPostIndicators, hasResourceCenter, hasNewsletterSignup,
    hasVideo, hasWebinar, hasPodcast, contentTypes,
    topicClusters: topicClusters.slice(0, 10), contentDepthScore,
  }
}

function detectCompetitivePositioning(html: string, mainText: string) {
  const hasComparisonPage = /比較|vs\.?|他社との違い|乗り換え/i.test(html)

  const differentiationMatches = mainText.match(/業界初|No\.?\s*1|日本初|唯一|国内シェア|特許|圧倒的|他社にない/gi) || []
  const differentiationClaims = [...new Set(differentiationMatches)]

  // 競合メンション検出（一般的な比較表現の近傍から企業名は抽出困難なため空配列）
  const mentionedCompetitors: string[] = []

  // ポジショニングタイプ判定
  let positioningType: 'leader' | 'challenger' | 'niche' | 'unclear' = 'unclear'
  const leaderPattern = /No\.?\s*1|シェア.?1位|業界トップ|国内最大|最大手/i
  const challengerPattern = /乗り換え|比較|よりも|他社より|切り替え/i
  const nichePattern = /専門|特化|ニッチ|唯一の|独自の/i

  if (leaderPattern.test(mainText)) positioningType = 'leader'
  else if (challengerPattern.test(mainText)) positioningType = 'challenger'
  else if (nichePattern.test(mainText)) positioningType = 'niche'

  const positioningScore = Math.min(100,
    (hasComparisonPage ? 20 : 0) +
    Math.min(40, differentiationClaims.length * 10) +
    (positioningType !== 'unclear' ? 25 : 0) +
    (mentionedCompetitors.length > 0 ? 15 : 0)
  )

  return {
    hasComparisonPage, mentionedCompetitors, differentiationClaims,
    positioningType, positioningScore,
  }
}

interface FetchResult {
  html: string
  headers: Record<string, string>
  responseTimeMs: number
  statusCode: number
  finalUrl: string
}

async function fetchPage(url: string, timeout = 10000): Promise<FetchResult | null> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DOYA_USER_AGENT },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const elapsed = Date.now() - start
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    return { html, headers, responseTimeMs: elapsed, statusCode: res.status, finalUrl: res.url }
  } catch {
    return null
  }
}

async function fetchPageSpeedInsights(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedData | null> {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || ''
    // PSI accepts multiple category params by appending
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo${apiKey ? `&key=${apiKey}` : ''}`

    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json()

    const lighthouse = data.lighthouseResult
    if (!lighthouse) return null

    const categories = lighthouse.categories || {}
    const audits = lighthouse.audits || {}

    // Extract CrUX data if available
    const crux = data.loadingExperience?.metrics || {}

    return {
      performanceScore: Math.round((categories.performance?.score || 0) * 100),
      accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
      bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),
      seoScore: Math.round((categories.seo?.score || 0) * 100),
      lcp: audits['largest-contentful-paint']?.numericValue ?? null,
      fcp: audits['first-contentful-paint']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      si: audits['speed-index']?.numericValue ?? null,
      tti: audits['interactive']?.numericValue ?? null,
      cruxLcp: crux['LARGEST_CONTENTFUL_PAINT_MS']?.percentile ?? null,
      cruxFid: crux['FIRST_INPUT_DELAY_MS']?.percentile ?? null,
      cruxCls: crux['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.percentile ?? null,
      cruxInp: crux['INTERACTION_TO_NEXT_PAINT']?.percentile ?? null,
      strategy,
    }
  } catch {
    return null
  }
}

// =============================================
// 2c. サブドメイン探索
// =============================================
const DOYA_USER_AGENT = 'Mozilla/5.0 (compatible; DoyaShindanBot/2.0; +https://doya-ai.surisuta.jp)'

async function discoverSubdomains(baseUrl: string, mainHtml: string): Promise<string[]> {
  const base = new URL(baseUrl)
  const rootDomain = base.hostname.replace(/^www\./, '')
  const found = new Set<string>()

  // Phase A: メインHTML中の href/src 属性からサブドメインURLを抽出
  const attrRegex = /(?:href|src)=["'](https?:\/\/([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+)[^"']*)/gi
  let m
  while ((m = attrRegex.exec(mainHtml)) !== null) {
    try {
      const hostname = m[2].toLowerCase()
      // rootDomain のサブドメインかつメインホスト名と異なるもの
      if (
        hostname.endsWith('.' + rootDomain) &&
        hostname !== base.hostname &&
        hostname !== rootDomain
      ) {
        found.add(`${base.protocol}//${hostname}`)
      }
    } catch {}
  }

  // Phase B: 一般的なサブドメインを並列プローブ（未発見のもののみ）
  const commonPrefixes = ['www', 'blog', 'shop', 'app', 'support', 'help', 'docs', 'api', 'cdn', 'mail', 'status']
  const toProbe = commonPrefixes
    .map((prefix) => `${base.protocol}//${prefix}.${rootDomain}`)
    .filter((u) => {
      try {
        const h = new URL(u).hostname
        return h !== base.hostname && !found.has(u)
      } catch { return false }
    })

  const probeResults = await Promise.all(
    toProbe.map(async (probeUrl) => {
      try {
        const res = await fetch(probeUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': DOYA_USER_AGENT },
          signal: AbortSignal.timeout(3000),
          redirect: 'follow',
        })
        if (res.ok) return probeUrl
      } catch {}
      return null
    })
  )
  for (const r of probeResults) {
    if (r) found.add(r)
  }

  return [...found].slice(0, 6)
}

// =============================================
// 2d. ディレクトリページ探索
// =============================================
function discoverDirectoryPages(internalLinks: string[], baseUrl: string): string[] {
  // 重要度の高いディレクトリキーワード（優先度順）
  const priorityDirs = [
    'services', 'service', 'products', 'product', 'works', 'work', 'case', 'cases',
    'recruit', 'careers', 'faq', 'privacy', 'access', 'company', 'about',
    'features', 'feature', 'portfolio', 'clients', 'team', 'contact',
    'サービス', '事業', '製品', '実績', '採用', 'よくある質問', 'アクセス',
  ]

  // 内部リンクをパス深度でグループ化
  const dirGroups: Record<string, string[]> = {}
  for (const link of internalLinks) {
    const parts = link.split('/').filter(Boolean)
    if (parts.length >= 1) {
      const dir = '/' + parts[0] + '/'
      if (!dirGroups[dir]) dirGroups[dir] = []
      dirGroups[dir].push(link)
    }
  }

  // スコアリング: 重要度 + サブページ数
  const scored: { url: string; score: number }[] = []
  for (const [dir, links] of Object.entries(dirGroups)) {
    let score = links.length // サブページ数が多いほど高スコア
    const dirLower = dir.toLowerCase()
    const priorityIdx = priorityDirs.findIndex((p) => dirLower.includes(p.toLowerCase()))
    if (priorityIdx >= 0) {
      score += (priorityDirs.length - priorityIdx) * 2 // 優先度が高いほどボーナス大
    }
    scored.push({ url: dir, score })
  }

  // スコア降順でソート
  scored.sort((a, b) => b.score - a.score)

  // 上位ディレクトリから深いページも含めて収集
  const result: string[] = []
  const alreadyInPriority = new Set<string>()

  for (const { url: dir } of scored) {
    if (result.length >= 8) break
    const links = dirGroups[dir] || []
    for (const link of links) {
      if (result.length >= 8) break
      // 既存の優先パスクロール（about/company/service等）で拾われていないものを追加
      const fullUrl = new URL(link, baseUrl).toString()
      if (!alreadyInPriority.has(link)) {
        result.push(fullUrl)
        alreadyInPriority.add(link)
      }
    }
  }

  return result
}

async function analyzeWebsite(url: string): Promise<WebsiteAnalysis | null> {
  const mainResult = await fetchPage(url, 15000)
  if (!mainResult) return null
  const mainHtml = mainResult.html

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

  // PageSpeed Insights を並列実行（結果は後で使う）
  const pageSpeedPromise = fetchPageSpeedInsights(url)

  const subPageResults = await Promise.all(
    priorityPaths.map((path) => fetchPage(new URL(path, url).toString(), 8000))
  )
  const validSubPages = subPageResults.filter(Boolean).map((r) => r!.html) as string[]
  const pagesCrawled = 1 + validSubPages.length

  let totalText = mainText
  for (const page of validSubPages) {
    totalText += ' ' + extractTextFromHTML(page).slice(0, 3000)
  }

  // Phase 2: サブドメイン探索
  const discoveredSubdomains = await discoverSubdomains(url, mainHtml)

  // Phase 3: ディレクトリ深掘り（既存の優先パスと重複しないURLのみ）
  const crawledPriorityUrls = new Set(priorityPaths.map((p) => new URL(p, url).toString()))
  const directoryPages = discoverDirectoryPages(internalLinks, url)
    .filter((u) => !crawledPriorityUrls.has(u))

  // Phase 2+3 の追加ページを並列フェッチ（最大10ページ）
  const additionalUrls = [
    ...discoveredSubdomains, // サブドメインのトップページ
    ...directoryPages,
  ].slice(0, 10)

  const additionalPageResults = await Promise.all(
    additionalUrls.map((u) => fetchPage(u, 8000))
  )
  const validAdditionalPages = additionalPageResults.filter(Boolean).map((r) => r!.html) as string[]

  // totalText にテキストを追加
  for (const page of validAdditionalPages) {
    totalText += ' ' + extractTextFromHTML(page).slice(0, 2000)
  }

  // pagesCrawled を更新
  const totalPagesCrawled = pagesCrawled + validAdditionalPages.length

  // クロールしたディレクトリ一覧を記録
  const crawledDirectories = directoryPages.filter((_, i) => {
    // サブドメイン分のオフセットを考慮
    const offsetIdx = discoveredSubdomains.length + i
    return offsetIdx < additionalUrls.length && additionalPageResults[offsetIdx] !== null
  })

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
  const sitemapResult = await fetchPage(new URL('/sitemap.xml', url).toString(), 5000)
  const sitemapHtml = sitemapResult?.html
  if (sitemapHtml && sitemapHtml.includes('<url>')) { seoScore += 5; positives.push('sitemap.xml設置済み') }
  else { issues.push('sitemap.xml未設置（クローラビリティに悪影響）') }

  // robots.txt確認 (5点)
  const robotsResult = await fetchPage(new URL('/robots.txt', url).toString(), 5000)
  const robotsTxt = robotsResult?.html
  if (robotsTxt && robotsTxt.length > 10) { seoScore += 5 }
  else { issues.push('robots.txt未設定') }

  // URL構造チェック (bonus 5点)
  const urlObj = new URL(url)
  const isCleanUrl = !/[?&].*=/.test(urlObj.pathname) && urlObj.pathname.length < 100
  if (isCleanUrl) { seoScore += 3; positives.push('クリーンなURL構造') }

  // meta robots チェック
  const metaRobots = meta['robots'] || ''
  if (metaRobots.includes('noindex')) { issues.push('meta robots: noindex（検索エンジンからインデックスされない）'); seoScore -= 10 }

  // favicon存在チェック
  const hasFavicon = /rel=["'](?:shortcut )?icon["']/i.test(mainHtml)
  if (hasFavicon) { positives.push('faviconあり') } else { issues.push('favicon未設定（ブランド認知に影響）') }

  // hreflang (国際化対応)
  const hasHreflang = /hreflang=/i.test(mainHtml)
  if (hasHreflang) { seoScore += 2; positives.push('多言語対応（hreflang）') }

  // 重複title/descriptionチェック（複数ページのmeta比較）
  const allPageMetas = [meta]
  for (const page of validSubPages) {
    allPageMetas.push(extractMetaTags(page))
  }
  const titles = allPageMetas.map(m => m.title).filter(Boolean)
  const uniqueTitles = new Set(titles)
  if (titles.length > 1 && uniqueTitles.size < titles.length) {
    issues.push(`titleタグ重複（${titles.length}ページ中${titles.length - uniqueTitles.size}件が同一title）`)
    seoScore -= 3
  }

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
  if (totalPagesCrawled >= 5) { contentScore += 15 }
  else if (totalPagesCrawled >= 3) { contentScore += 10 }
  else if (totalPagesCrawled >= 2) { contentScore += 5; issues.push('サブページが少ない（サイト規模不足）') }
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

  // レスポンスタイム分析
  if (mainResult) {
    if (mainResult.responseTimeMs < 1000) { technicalScore += 5; positives.push(`高速レスポンス（${mainResult.responseTimeMs}ms）`) }
    else if (mainResult.responseTimeMs > 3000) { issues.push(`レスポンス遅延（${mainResult.responseTimeMs}ms、3秒超）`) }
  }

  // セキュリティヘッダー
  if (mainResult?.headers) {
    const secHeaders = ['x-frame-options', 'x-content-type-options', 'strict-transport-security', 'content-security-policy']
    const foundSecHeaders = secHeaders.filter(h => mainResult.headers[h])
    if (foundSecHeaders.length >= 3) { technicalScore += 5; positives.push(`セキュリティヘッダー充実（${foundSecHeaders.length}/4）`) }
    else if (foundSecHeaders.length === 0) { issues.push('セキュリティヘッダー未設定（XSS/クリックジャッキング脆弱性）') }
  }

  // JS/CSSリソース数カウント
  const jsCount = (mainHtml.match(/<script[^>]+src=/gi) || []).length
  const cssCount = (mainHtml.match(/<link[^>]+stylesheet/gi) || []).length
  if (jsCount > 20) { issues.push(`JavaScript過多（${jsCount}ファイル、表示速度に影響）`) }
  if (cssCount > 10) { issues.push(`CSS過多（${cssCount}ファイル）`) }
  if (jsCount <= 10 && cssCount <= 5) { technicalScore += 3; positives.push('リソース数適正') }

  // 遅延読み込み
  const hasLazyLoading = /loading=["']lazy["']|data-src=|lazyload/i.test(mainHtml)
  if (hasLazyLoading) { technicalScore += 3; positives.push('遅延読み込み実装') }
  else if (images.total > 5) { issues.push('遅延読み込み未実装（画像が多いため表示速度に影響）') }

  // インラインスタイル量
  const inlineStyles = (mainHtml.match(/style=["'][^"']{50,}["']/g) || []).length
  if (inlineStyles > 20) { issues.push(`インラインスタイル過多（${inlineStyles}箇所、保守性に影響）`) }

  // Web Vitals指標 (LCP候補検出)
  const hasLargeHeroImage = /<img[^>]+(?:hero|banner|main|key|visual)[^>]*/i.test(mainHtml)
  const heroImagePreloaded = /<link[^>]+rel=["']preload["'][^>]+as=["']image["']/i.test(mainHtml)
  if (hasLargeHeroImage && !heroImagePreloaded) { issues.push('ヒーロー画像のpreload未設定（LCP改善の余地）') }

  // PageSpeed Insights 結果を取得
  const pageSpeedData = await pageSpeedPromise

  // PageSpeed Insights スコアをテクニカルスコアに反映
  if (pageSpeedData) {
    // Performance score bonus (up to 15 points, replacing some of the simpler checks)
    const psiPerfBonus = Math.round(pageSpeedData.performanceScore * 0.15)
    technicalScore += psiPerfBonus

    if (pageSpeedData.performanceScore >= 90) positives.push(`Lighthouseパフォーマンス優秀（${pageSpeedData.performanceScore}点）`)
    else if (pageSpeedData.performanceScore < 50) issues.push(`Lighthouseパフォーマンス低スコア（${pageSpeedData.performanceScore}点、改善が急務）`)

    // LCP check
    if (pageSpeedData.lcp != null) {
      if (pageSpeedData.lcp > 4000) issues.push(`LCP遅延（${(pageSpeedData.lcp / 1000).toFixed(1)}秒、推奨2.5秒以下）`)
      else if (pageSpeedData.lcp <= 2500) positives.push(`LCP良好（${(pageSpeedData.lcp / 1000).toFixed(1)}秒）`)
    }

    // CLS check
    if (pageSpeedData.cls != null) {
      if (pageSpeedData.cls > 0.25) issues.push(`CLS高（${pageSpeedData.cls.toFixed(3)}、推奨0.1以下。レイアウトシフトが多い）`)
      else if (pageSpeedData.cls <= 0.1) positives.push(`CLS良好（${pageSpeedData.cls.toFixed(3)}）`)
    }

    // TBT check (proxy for INP)
    if (pageSpeedData.tbt != null) {
      if (pageSpeedData.tbt > 600) issues.push(`TBT高（${Math.round(pageSpeedData.tbt)}ms、インタラクション応答が遅い）`)
      else if (pageSpeedData.tbt <= 200) positives.push(`TBT良好（${Math.round(pageSpeedData.tbt)}ms）`)
    }

    // Accessibility bonus
    if (pageSpeedData.accessibilityScore >= 90) positives.push(`アクセシビリティ優秀（Lighthouse ${pageSpeedData.accessibilityScore}点）`)
    else if (pageSpeedData.accessibilityScore < 50) issues.push(`アクセシビリティ低スコア（Lighthouse ${pageSpeedData.accessibilityScore}点）`)
  }

  const totalScore = Math.round(seoScore * 0.40 + contentScore * 0.35 + technicalScore * 0.25)

  // ----- 拡張検出分析（全クロールページのHTMLを結合して深い検出）-----
  const allHtml = [mainHtml, ...validSubPages, ...validAdditionalPages].join('\n')
  const allText = totalText // already has combined text
  const allInternalLinks = extractInternalLinks(allHtml, url)

  const tracking = detectTracking(allHtml)
  const appealAxis = detectAppealAxis(allHtml, headings, allText)
  const socialProofData = detectSocialProof(allHtml, allText)
  const ctaAnalysis = detectCTADetails(allHtml)
  const pricingSignals = detectPricingSignals(allHtml, allInternalLinks)
  const contentMarketingData = detectContentMarketing(allHtml, allInternalLinks)
  const competitivePositioningData = detectCompetitivePositioning(allHtml, allText)

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
    pagesCrawled: totalPagesCrawled,
    socialLinks,
    hasBlog: blog,
    hasForm: hasForm,
    hasSchema: hasSchema,
    imageStats: images,
    textExcerpt: mainText.slice(0, 4000),
    ogImage: meta['og:image']
      ? (meta['og:image'].startsWith('http') ? meta['og:image'] : (() => { try { return new URL(meta['og:image'], url).toString() } catch { return null } })())
      : null,
    tracking,
    appealAxis,
    socialProof: socialProofData,
    ctaAnalysis,
    pricingSignals,
    contentMarketing: contentMarketingData,
    competitivePositioning: competitivePositioningData,
    discoveredSubdomains,
    crawledDirectories,
    responseTimeMs: mainResult.responseTimeMs,
    securityHeaders: mainResult.headers
      ? ['x-frame-options', 'x-content-type-options', 'strict-transport-security', 'content-security-policy']
          .filter(h => mainResult.headers[h])
      : undefined,
    jsFileCount: jsCount,
    cssFileCount: cssCount,
    hasLazyLoading,
    hasFavicon,
    redirectChain: mainResult.finalUrl !== url ? mainResult.finalUrl : undefined,
    pageSpeed: pageSpeedData || undefined,
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




function scoreToGrade(score: number): string {
  if (score >= 82) return 'S'
  if (score >= 68) return 'A'
  if (score >= 52) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

// =============================================
// Web7軸定義
// =============================================
const WEB_AXES = [
  { id: 'seo', label: 'SEO対策', weight: 0.20 },
  { id: 'content', label: 'コンテンツ力', weight: 0.15 },
  { id: 'conversion', label: 'コンバージョン設計', weight: 0.18 },
  { id: 'tracking', label: '集客・広告基盤', weight: 0.12 },
  { id: 'branding', label: '訴求力・ブランディング', weight: 0.13 },
  { id: 'trust', label: '信頼性・社会的証明', weight: 0.10 },
  { id: 'technical', label: '技術・パフォーマンス', weight: 0.12 },
] as const

function calculateWebAxes(ws: WebsiteAnalysis): Record<string, number> {
  return {
    seo: ws.seoScore,
    content: Math.round((ws.contentScore + (ws.contentMarketing?.contentDepthScore || 0)) / 2),
    conversion: Math.round(((ws.ctaAnalysis?.ctaEffectivenessScore || 0) + (ws.pricingSignals?.pricingTransparencyScore || 0)) / 2),
    tracking: ws.tracking?.trackingScore || 0,
    branding: Math.round(((ws.appealAxis?.appealScore || 0) + (ws.competitivePositioning?.positioningScore || 0)) / 2),
    trust: ws.socialProof?.socialProofScore || 0,
    technical: ws.technicalScore,
  }
}

function calculateOverallWebScore(axisScores: Record<string, number>): number {
  let total = 0
  let totalWeight = 0
  for (const axis of WEB_AXES) {
    const score = axisScores[axis.id] ?? 0
    total += score * axis.weight
    totalWeight += axis.weight
  }
  return Math.round(total / totalWeight)
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
  websiteUrl: string,
  siteTitle?: string,
  siteDescription?: string,
): Promise<DiscoveredCompetitor[]> {
  const context = [
    `自社URL: ${websiteUrl}`,
    siteTitle ? `サイトタイトル: ${siteTitle}` : '',
    siteDescription ? `サイト説明: ${siteDescription}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `あなたは日本のビジネス競合分析の専門家です。
以下のWebサイト情報から、このサイトの直接的な競合となりうるWebサイトURLを5つ推測してください。

${context}

条件:
- 実在する企業・サービスのURLのみ（.co.jp, .jp, .com のドメイン）
- サイトタイトルやサービス内容からキーワード・業種を推測し、同じキーワードで検索上位に表示される競合サイトを優先
- 同業種・同規模で市場が重なる企業を優先
- 大手〜中堅の知名度がある企業を含める（クロール可能なURL）
- このサイトと同じ市場で競合するサイトを選ぶ

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
    tracking: ws.tracking,
    appealAxis: ws.appealAxis,
    socialProof: ws.socialProof,
    ctaAnalysis: ws.ctaAnalysis,
    pricingSignals: ws.pricingSignals,
    contentMarketing: ws.contentMarketing,
    competitivePositioning: ws.competitivePositioning,
    discoveredSubdomains: ws.discoveredSubdomains,
    crawledDirectories: ws.crawledDirectories,
    responseTimeMs: ws.responseTimeMs,
    securityHeaders: ws.securityHeaders,
    jsFileCount: ws.jsFileCount,
    cssFileCount: ws.cssFileCount,
    hasLazyLoading: ws.hasLazyLoading,
    hasFavicon: ws.hasFavicon,
    pageSpeed: ws.pageSpeed,
  }
}


// =============================================
// 7. プロンプト生成
// =============================================

function buildPrompt(
  axisScores: Record<string, number>,
  overallScore: number,
  grade: string,
  ws: WebsiteAnalysis | null,
  competitorAnalyses: WebsiteAnalysis[],
): string {
  const axisLines = WEB_AXES.map((a) => `- ${a.label}: ${axisScores[a.id]}/100`).join('\n')

  let websiteSection = ''
  if (ws) {
    websiteSection = `
## 自社Webサイト分析データ
URL: ${ws.url}
クロールページ数: ${ws.pagesCrawled}
タイトル: ${ws.meta.title || '未設定'}
ディスクリプション: ${ws.meta.description || '未設定'}
テキスト量: ${ws.textLength}文字
画像数: ${ws.imageStats.total}（alt属性あり: ${ws.imageStats.withAlt}）
構造化データ: ${ws.hasSchema ? 'あり' : 'なし'}
ブログ: ${ws.hasBlog ? 'あり' : 'なし'}
フォーム: ${ws.hasForm ? 'あり' : 'なし'}
SNSリンク: ${ws.socialLinks.join(', ') || 'なし'}
見出し: ${ws.headings.slice(0, 10).join(' / ')}
レスポンスタイム: ${ws.responseTimeMs ? ws.responseTimeMs + 'ms' : '不明'}
セキュリティヘッダー: ${ws.securityHeaders?.join(', ') || '未検出'}
JSファイル数: ${ws.jsFileCount ?? '不明'}
CSSファイル数: ${ws.cssFileCount ?? '不明'}
遅延読み込み: ${ws.hasLazyLoading ? 'あり' : 'なし'}
favicon: ${ws.hasFavicon ? 'あり' : 'なし'}
${ws.pageSpeed ? `
### PageSpeed Insights (Lighthouse)
パフォーマンス: ${ws.pageSpeed.performanceScore}/100
アクセシビリティ: ${ws.pageSpeed.accessibilityScore}/100
ベストプラクティス: ${ws.pageSpeed.bestPracticesScore}/100
SEO: ${ws.pageSpeed.seoScore}/100
LCP: ${ws.pageSpeed.lcp ? (ws.pageSpeed.lcp / 1000).toFixed(1) + '秒' : '不明'}
FCP: ${ws.pageSpeed.fcp ? (ws.pageSpeed.fcp / 1000).toFixed(1) + '秒' : '不明'}
CLS: ${ws.pageSpeed.cls?.toFixed(3) ?? '不明'}
TBT: ${ws.pageSpeed.tbt ? Math.round(ws.pageSpeed.tbt) + 'ms' : '不明'}
TTI: ${ws.pageSpeed.tti ? (ws.pageSpeed.tti / 1000).toFixed(1) + '秒' : '不明'}` : ''}

### 検出済み広告・トラッキング
${ws.tracking ? `ツール: ${ws.tracking.detectedTools.join(', ') || 'なし'} (スコア: ${ws.tracking.trackingScore})` : '未検出'}

### 訴求軸
${ws.appealAxis ? `ヒーロー: "${ws.appealAxis.heroText}" (タイプ: ${ws.appealAxis.heroType})\nUSP: ${ws.appealAxis.uspKeywords.join(', ') || 'なし'}\nベネフィット表現: ${ws.appealAxis.benefitStatements.join(', ') || 'なし'}` : '未検出'}

### 社会的証明
${ws.socialProof ? `要素: ${ws.socialProof.proofElements.join(', ') || 'なし'}\nユーザー数: ${ws.socialProof.userCountText || '不明'}` : '未検出'}

### CTA分析
${ws.ctaAnalysis ? `CTAテキスト: ${ws.ctaAnalysis.ctaTexts.join(', ') || 'なし'}\n配置: ${ws.ctaAnalysis.ctaPlacement}\nリードマグネット: ${ws.ctaAnalysis.hasLeadMagnet ? 'あり' : 'なし'}` : '未検出'}

### 料金シグナル
${ws.pricingSignals ? `モデル: ${ws.pricingSignals.pricingModel}\n無料トライアル: ${ws.pricingSignals.hasFreeTrial ? 'あり' : 'なし'}\n返金保証: ${ws.pricingSignals.hasMoneyBackGuarantee ? 'あり' : 'なし'}` : '未検出'}

### コンテンツマーケティング
${ws.contentMarketing ? `種類: ${ws.contentMarketing.contentTypes.join(', ') || 'なし'}\nニュースレター: ${ws.contentMarketing.hasNewsletterSignup ? 'あり' : 'なし'}` : '未検出'}

### 競争ポジショニング
${ws.competitivePositioning ? `タイプ: ${ws.competitivePositioning.positioningType}\n差別化主張: ${ws.competitivePositioning.differentiationClaims.join(', ') || 'なし'}` : '未検出'}

発見された問題: ${ws.issues.join(' / ')}
良い点: ${ws.positives.join(' / ')}
`
  }

  let competitorSection = ''
  if (competitorAnalyses.length > 0) {
    competitorSection = '\n## 競合サイト分析データ\n' + competitorAnalyses.map((c, i) => {
      return `### 競合${i + 1}: ${c.url}
タイトル: ${c.meta.title || '不明'}
SEO: ${c.seoScore} / コンテンツ: ${c.contentScore} / 技術: ${c.technicalScore}
広告ツール: ${c.tracking?.detectedTools?.join(', ') || 'なし'}
訴求: ${c.appealAxis?.heroText || '不明'} (${c.appealAxis?.heroType || '不明'})
社会的証明: ${c.socialProof?.proofElements?.join(', ') || 'なし'}
CTA: ${c.ctaAnalysis?.ctaTexts?.join(', ') || 'なし'}
料金モデル: ${c.pricingSignals?.pricingModel || '不明'}
コンテンツ種類: ${c.contentMarketing?.contentTypes?.join(', ') || 'なし'}
ポジショニング: ${c.competitivePositioning?.positioningType || '不明'}
問題: ${c.issues.join(' / ')}
良い点: ${c.positives.join(' / ')}`
    }).join('\n\n')
  }

  return `あなたはWebサイト競合分析の辛口コンサルタントです。
以下のデータを基に、このWebサイトの改善点を競合と比較しながら徹底的に分析してください。

## 基本情報
総合スコア: ${overallScore}/100 (${grade}ランク)

## 7軸評価スコア
${axisLines}

${websiteSection}
${competitorSection}

以下のJSON形式で回答してください。全て日本語で記述。

{
  "summary": "総合診断コメント（3-5文。このサイトの全体的な評価と最も重要な課題を述べる。辛口かつ具体的に）",

  "axesImprovements": {
    "seo": {
      "status": "good | warning | critical",
      "competitorGap": "競合と比較した差分を1-2文で（例：競合は構造化データとmeta descriptionが最適化済みだが、自社は未対応）",
      "improvementPoints": ["具体的な改善点を3-5個。「〇〇を□□に変更すべき」のように具体的に"],
      "competitorAdvantages": ["競合が自社より優れている点を2-3個"],
      "yourAdvantages": ["自社が競合より優れている点を1-2個（あれば）"]
    },
    "content": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] },
    "conversion": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] },
    "tracking": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] },
    "branding": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] },
    "trust": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] },
    "technical": { "status": "...", "competitorGap": "...", "improvementPoints": ["..."], "competitorAdvantages": ["..."], "yourAdvantages": ["..."] }
  },

  "strengths": [
    { "title": "強みのタイトル", "description": "なぜこれが強みか、どう活かせるか" }
  ],

  "bottlenecks": [
    { "title": "ボトルネック名", "severity": "high | medium | low", "description": "何が問題か", "impact": "これによる影響" }
  ],

  "recommendations": [
    { "title": "施策名", "priority": "high | medium | low", "description": "具体的にやること", "estimatedCost": "費用感", "estimatedEffect": "期待効果", "timeframe": "実施期間", "quickWin": true }
  ],

  "competitiveDetailedComparison": {
    "trackingComparison": "自社vs競合の広告・トラッキング活用度比較",
    "appealAxisComparison": "訴求軸の比較分析",
    "socialProofComparison": "社会的証明の充実度比較",
    "ctaComparison": "CTA設計の比較",
    "pricingComparison": "料金表示戦略の比較",
    "contentComparison": "コンテンツ戦略の比較",
    "overallWebPositioning": "総合的なWeb競争力分析"
  }
}

注意事項:
- strengthsは3-5件
- bottlenecksは3-5件。severityは本当に深刻なものだけhigh
- recommendationsは必ず7件。quickWin=trueは1-2件（今すぐ低コストで始められるもの）
- competitiveDetailedComparisonは競合サイトの分析結果がある場合はそれを参照し、各項目で自社と競合を具体的に比較すること
- axesImprovementsの各軸のstatusは: スコア70以上=good, 40-69=warning, 39以下=critical
- JSONのみ返すこと`
}

// =============================================
// 8. POST ハンドラ（SSE ストリーミング版）
// =============================================
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの解析に失敗しました' }, { status: 400 })
  }

  const { url: websiteUrl } = body as {
    url: string
  }

  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    return NextResponse.json({ error: 'WebサイトURLは必須です' }, { status: 400 })
  }

  // --- 認証 + 回数制限（既存のまま）---
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
        const todayJST = new Date(getTodayDateJST())
        await prisma.userServiceSubscription.upsert({
          where: { userId_serviceId: { userId: user.id, serviceId: 'shindan' } },
          update: { dailyUsage: needsReset ? 1 : { increment: 1 }, lastUsageReset: needsReset ? todayJST : undefined },
          create: { userId: user.id, serviceId: 'shindan', plan: 'FREE', dailyUsage: 1, lastUsageReset: todayJST },
        })
      }
    }
  }

  // --- SSE ストリーム開始 ---
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: any) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        // ========== A. analyzing イベント ==========
        sendEvent('analyzing', {
          message: 'Webサイトの分析を開始しました...',
        })

        // ========== B. Webサイト分析 ==========
        const websiteAnalysis = await analyzeWebsite(websiteUrl)

        // >>> SSE: website イベント
        sendEvent('website', {
          websiteHealth: websiteAnalysis ? websiteToFrontend(websiteAnalysis) : null,
        })

        // >>> SSE: pagespeed イベント（websiteAnalysisに含まれるPSIデータ）
        if (websiteAnalysis?.pageSpeed) {
          sendEvent('pagespeed', {
            pageSpeed: websiteAnalysis.pageSpeed,
          })
        }

        // ========== B2. 競合自動発見（サイト分析結果を活用）==========
        const discoveredCompetitorList = await discoverCompetitors(
          websiteUrl,
          websiteAnalysis?.meta?.title,
          websiteAnalysis?.meta?.description || websiteAnalysis?.meta?.['og:description'],
        )

        // >>> SSE: discovery イベント
        sendEvent('discovery', {
          discoveredCompetitors: discoveredCompetitorList,
        })

        // ========== C. 競合サイト分析 ==========
        const competitorAnalyses: WebsiteAnalysis[] = []
        const discoveredUrls = discoveredCompetitorList.map((c) => c.url)
        const allCompetitorUrls = [...new Set(discoveredUrls)].slice(0, 5)

        if (allCompetitorUrls.length > 0) {
          const results = await Promise.all(allCompetitorUrls.map((u: string) => analyzeWebsite(u)))
          for (const r of results) {
            if (r) competitorAnalyses.push(r)
          }
        }

        // >>> SSE: competitors イベント
        sendEvent('competitors', {
          competitorComparison: competitorAnalyses.map((c) => websiteToFrontend(c)),
        })

        // ========== D. 7軸スコア算出 ==========
        const axisScores = websiteAnalysis ? calculateWebAxes(websiteAnalysis) : WEB_AXES.reduce((acc, a) => ({ ...acc, [a.id]: 0 }), {} as Record<string, number>)
        const overallScore = calculateOverallWebScore(axisScores)
        const grade = scoreToGrade(overallScore)

        // >>> SSE: scoring イベント
        sendEvent('scoring', {
          axisScores,
          overallScore,
          overallGrade: grade,
        })

        // ========== E. Gemini AI分析 ==========
        const prompt = buildPrompt(
          axisScores, overallScore, grade,
          websiteAnalysis, competitorAnalyses,
        )
        const geminiResult = await geminiGenerateJson<any>(prompt, 8192)

        // ========== F. 結果マージ ==========
        const result = {
          overallScore,
          overallGrade: grade,
          summary: geminiResult.summary || '',
          axesScores: axisScores,
          axesImprovements: geminiResult.axesImprovements || {},
          strengths: (geminiResult.strengths || []).map((s: any) => ({
            title: s.title || '',
            description: s.description || '',
          })),
          bottlenecks: (geminiResult.bottlenecks || []).map((b: any) => ({
            title: b.title || '',
            description: b.description || '',
            severity: b.severity || 'medium',
            impact: b.impact || '',
          })),
          recommendations: (geminiResult.recommendations || []).map((r: any) => ({
            title: r.title || '',
            description: r.description || '',
            priority: r.priority || 'medium',
            estimatedCost: r.estimatedCost || '',
            estimatedEffect: r.estimatedEffect || '',
            timeframe: r.timeframe || '',
            quickWin: r.quickWin || false,
          })),
          competitiveDetailedComparison: geminiResult.competitiveDetailedComparison || null,
          websiteAnalysis: websiteAnalysis ? websiteToFrontend(websiteAnalysis) : null,
          competitorAnalyses: competitorAnalyses.map((c) => websiteToFrontend(c)),
          discoveredCompetitors: discoveredCompetitorList,
        }

        // >>> SSE: complete イベント
        sendEvent('complete', { result })

      } catch (err: any) {
        console.error('[shindan/generate] SSE Error:', err)
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
