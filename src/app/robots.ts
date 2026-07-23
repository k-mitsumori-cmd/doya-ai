import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.url

  const disallowCommon = [
    '/api/',
    '/admin/',
    '/_next/',
    '/dashboard/*/text/*',  // テンプレート個別ページ（動的）
  ]

  // LLMO: 主要な生成AI/検索AIのクローラを明示的に許可（学習・回答時の引用を得るため）
  const aiCrawlers = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',   // OpenAI
    'ClaudeBot', 'Claude-Web', 'anthropic-ai',    // Anthropic
    'PerplexityBot', 'Perplexity-User',           // Perplexity
    'Google-Extended',                            // Google (Gemini/Vertex)
    'Applebot-Extended',                          // Apple Intelligence
    'CCBot',                                      // Common Crawl
    'Bytespider', 'Amazonbot', 'meta-externalagent',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowCommon,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      // AIクローラは公開ページ全体を許可（/api・/admin は除外）
      ...aiCrawlers.map((ua) => ({
        userAgent: ua,
        allow: '/',
        disallow: ['/api/', '/admin/'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}

