// ============================================
// LP用 構造化データ（JSON-LD）
// SoftwareApplication + FAQPage + BreadcrumbList をまとめて出力。
// LLMO/リッチリザルト強化のため全サービスLPで注入する。
// ============================================
import React from 'react'
import { SITE_CONFIG } from '@/lib/seo'
import type { Faq } from './sections'

function abs(path: string) {
  return `${SITE_CONFIG.url}${path.startsWith('/') ? path : `/${path}`}`
}

export function LpJsonLd({
  name,
  path,
  description,
  category = 'BusinessApplication',
  features,
  faq,
  price = '9980',
  hasFreeTier = true,
  includeSoftwareApp = true,
}: {
  name: string
  path: string
  description: string
  category?: 'BusinessApplication' | 'DesignApplication' | 'MultimediaApplication' | 'WebApplication'
  features?: string[]
  faq?: Faq[]
  price?: string
  hasFreeTier?: boolean
  /** 親layoutが既にSoftwareApplicationを注入している場合はfalseで重複回避 */
  includeSoftwareApp?: boolean
}) {
  const url = abs(path)

  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: category,
    operatingSystem: 'Web',
    url,
    description,
    ...(features?.length ? { featureList: features } : {}),
    offers: {
      '@type': 'Offer',
      price: hasFreeTier ? '0' : price,
      priceCurrency: 'JPY',
      description: hasFreeTier
        ? `無料プランあり。プロプラン（月額${Number(price).toLocaleString()}円）で全ツールが利用可能`
        : `プロプラン 月額${Number(price).toLocaleString()}円`,
    },
    publisher: {
      '@type': 'Organization',
      name: '株式会社スリスタ',
      url: SITE_CONFIG.url,
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ドヤマーケAI', item: SITE_CONFIG.url },
      { '@type': 'ListItem', position: 2, name, item: url },
    ],
  }

  const faqPage = faq?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null

  const graph = [...(includeSoftwareApp ? [softwareApp] : []), breadcrumb, ...(faqPage ? [faqPage] : [])]

  return (
    <>
      {graph.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }} />
      ))}
    </>
  )
}
