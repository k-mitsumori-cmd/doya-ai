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
    {
      url: `${baseUrl}/auth/signin`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
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

  // アクティブなサービスのページ
  const activeServices = getActiveServices().filter(s => !HIDDEN_SERVICE_IDS.has(s.id))
  const servicePages: MetadataRoute.Sitemap = activeServices.flatMap((service) => [
    // サービスLP
    {
      url: `${baseUrl}${service.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    // ダッシュボード（認証後）
    {
      url: `${baseUrl}${service.dashboardHref}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    // 料金ページ
    {
      url: `${baseUrl}${service.pricingHref}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    // ガイドページ
    {
      url: `${baseUrl}${service.guideHref}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
  ])

  // 近日公開サービスのLP（Coming Soon）
  const comingSoonServices = getAllServices().filter(
    s => s.status === 'coming_soon' && !HIDDEN_SERVICE_IDS.has(s.id)
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

