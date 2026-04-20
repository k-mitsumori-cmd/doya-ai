/**
 * Google PageSpeed Insights API クライアント
 * 既存 `/api/shindan/generate` でも使われている `GOOGLE_PAGESPEED_API_KEY` を流用。
 */

import type { PageSpeedResult } from './types'

const ENDPOINT =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

export async function fetchPageSpeed(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedResult | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  if (!apiKey) {
    // API キー未設定時は null を返して呼び出し元で fallback させる
    return null
  }

  const params = new URLSearchParams({
    url,
    strategy,
    key: apiKey,
  })
  for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
    params.append('category', cat)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

  let data: any
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }

  const lh = data?.lighthouseResult
  if (!lh) return null

  const cat = lh.categories || {}
  const audits = lh.audits || {}
  const perf = cat.performance?.score != null ? Math.round(cat.performance.score * 100) : null
  const a11y =
    cat.accessibility?.score != null ? Math.round(cat.accessibility.score * 100) : null
  const bp =
    cat['best-practices']?.score != null
      ? Math.round(cat['best-practices'].score * 100)
      : null
  const seo = cat.seo?.score != null ? Math.round(cat.seo.score * 100) : null

  const lcp = audits['largest-contentful-paint']?.numericValue ?? null
  const fcp = audits['first-contentful-paint']?.numericValue ?? null
  const cls = audits['cumulative-layout-shift']?.numericValue ?? null
  const tbt = audits['total-blocking-time']?.numericValue ?? null
  const ttfb = audits['server-response-time']?.numericValue ?? null

  const opportunityIds = [
    'unused-javascript',
    'render-blocking-resources',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'offscreen-images',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'server-response-time',
    'font-display',
  ]
  const opportunities = opportunityIds
    .map((id) => {
      const a = audits[id]
      if (!a || a.score === 1 || a.score == null) return null
      return {
        id,
        title: String(a.title || id),
        description: String(a.description || ''),
        savings: a.details?.overallSavingsMs ?? undefined,
      }
    })
    .filter(Boolean) as PageSpeedResult['opportunities']

  return {
    strategy,
    performanceScore: perf,
    accessibilityScore: a11y,
    bestPracticesScore: bp,
    seoScore: seo,
    lcp,
    fcp,
    cls,
    tbt,
    ttfb,
    opportunities,
  }
}
