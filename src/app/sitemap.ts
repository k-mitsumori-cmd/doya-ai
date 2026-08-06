import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/seo'
import { getAllServices, getActiveServices, HIDDEN_SERVICE_IDS } from '@/lib/services'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.url
  const now = new Date()
  
  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // ログインページは sitemap に載せない（noindex 対象。指名検索の受け皿はトップと各LP）
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/tokushoho`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // 実在するガイドページを持つサービス（services.ts の guideHref は未実装でも値が入っている）
  // ここに無いサービスの guideHref は 404 になるため sitemap に載せない
  const SERVICES_WITH_GUIDE = new Set(['adsim', 'copy', 'lp', 'movie', 'opening', 'voice'])
  // 実在する /{id}/pricing を持つサービス。
  // services.ts の pricingHref はLPと同じ値のことがある（例: seo → '/seo'）ため、
  // 実在する料金ページを sitemap から落とさないようここで補う。
  const SERVICES_WITH_PRICING_PAGE = new Set([
    'adbanner', 'adsim', 'aio', 'banner', 'copy', 'cunning', 'doyalist', 'doyaslide',
    'hr', 'interview', 'interviewx', 'kintai', 'lp', 'movie', 'opening', 'persona',
    'promane', 'seo', 'sfa', 'shodan', 'tenkai', 'voice',
  ])
  // LP が別URLへリダイレクトするサービス（sitemap に載せるとリダイレクトURLを送ることになる）
  const REDIRECTING_LP = new Set(['tenkai', 'kantan'])

  // アクティブなサービスのページ
  // ダッシュボード（ログイン後のアプリ画面）は noindex 対象なので載せない。
  // sitemap に残すと指名検索の受け皿がLPではなくアプリ画面になってしまう。
  const activeServices = getActiveServices().filter(
    s => !HIDDEN_SERVICE_IDS.has(s.id) && !REDIRECTING_LP.has(s.id)
  )
  const servicePages: MetadataRoute.Sitemap = activeServices.flatMap((service) => [
    // サービスLP（指名検索の受け皿）
    {
      url: `${baseUrl}${service.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    // 料金ページ
    {
      url: `${baseUrl}${SERVICES_WITH_PRICING_PAGE.has(service.id) ? `/${service.id}/pricing` : service.pricingHref}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    // ガイドページ（実在するものだけ）
    ...(SERVICES_WITH_GUIDE.has(service.id)
      ? [
          {
            url: `${baseUrl}${service.guideHref}`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          },
        ]
      : []),
  ])

  // 近日公開サービスのLP（Coming Soon）
  const comingSoonServices = getAllServices().filter(
    s => s.status === 'coming_soon' && !HIDDEN_SERVICE_IDS.has(s.id) && !REDIRECTING_LP.has(s.id)
  )
  const comingSoonPages: MetadataRoute.Sitemap = comingSoonServices.map((service) => ({
    url: `${baseUrl}${service.href}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  // 同一URLの重複を除去（例: dashboardHref/pricingHref がLPと同じ '/seo' のケース）
  // 先勝ち＝priorityの高いエントリが残る並び順にしてある
  const seen = new Set<string>()
  return [...staticPages, ...servicePages, ...comingSoonPages].filter((entry) => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}

