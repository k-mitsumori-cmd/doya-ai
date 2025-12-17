import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/seo'
import { getAllServices, getActiveServices } from '@/lib/services'

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
  ]

  // アクティブなサービスのページ
  const activeServices = getActiveServices()
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
  const comingSoonServices = getAllServices().filter(s => s.status === 'coming_soon')
  const comingSoonPages: MetadataRoute.Sitemap = comingSoonServices.map((service) => ({
    url: `${baseUrl}${service.href}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  return [...staticPages, ...servicePages, ...comingSoonPages]
}

