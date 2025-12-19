// ============================================
// SEO設定
// ============================================

import { SEO_PRICING, BANNER_PRICING, KANTAN_PRICING } from './pricing'

export const SITE_CONFIG = {
  name: 'ドヤAI',
  tagline: 'ビジネスを加速するAIツール群',
  description: 'SEO記事生成、バナー作成、LP制作など、ビジネスに必要なAIツールを1つのアカウントで利用可能。ドヤSEO、ドヤバナーAIなど続々追加中。',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.vercel.app',
  locale: 'ja_JP',
  twitter: '@doya_ai',
  // OGP画像のベースURL
  ogImageBase: '/og',
}

// 各サービスのSEO設定
export const SERVICE_SEO = {
  // ポータル
  portal: {
    title: 'ドヤAIポータル | ビジネスを加速するAIツール群',
    description: 'SEO記事生成、バナー作成、LP制作など、ビジネスに必要なAIツールを1つのアカウントで利用可能。ドヤSEO、ドヤバナーAIなど続々追加中。',
    keywords: ['AI', 'ビジネスツール', '文章生成', 'バナー作成', 'LP作成', '自動化'],
    ogImage: '/og/portal.png',
  },
  
  // カンタンドヤAI
  kantan: {
    title: 'カンタンドヤAI | テンプレでビジネス文章をAI自動生成',
    description:
      'メール、ブログ、SNS投稿、提案書…テンプレートを選んで情報を入れるだけで、読みやすい文章をAIが自動生成します。',
    keywords: ['文章生成', 'ビジネスメール', '提案書', '議事録', 'SNS投稿', 'テンプレート', '生成AI'],
    ogImage: '/og/portal.png',
    sections: {
      dashboard: {
        title: 'ダッシュボード | カンタンドヤAI',
        description: 'テンプレートを選んで文章を作成。履歴の確認もできます。',
      },
      pricing: {
        title: '料金プラン | カンタンドヤAI',
        description: `無料プランはゲスト1日${KANTAN_PRICING.guestLimit}回、ログイン後1日${KANTAN_PRICING.freeLimit}回まで。プロプランは1日${KANTAN_PRICING.proLimit}回まで。`,
      },
      guide: {
        title: '使い方 | カンタンドヤAI',
        description: 'テンプレートの選び方、入力のコツ、文章品質を上げるポイントを解説します。',
      },
    },
  },
  
  // ドヤSEO
  seo: {
    title: 'ドヤSEO | SEO + LLMOに強い長文記事を安定生成',
    description: 'アウトライン→分割生成→整合性チェック→統合のパイプラインで、長文でも崩れにくい記事生成を目指します。',
    keywords: ['SEO', '記事生成', 'アウトライン', 'LLMO', 'コンテンツマーケ', '生成AI'],
    ogImage: '/og/seo.png',
    sections: {
      dashboard: {
        title: 'ダッシュボード | ドヤSEO',
        description: '記事一覧・進捗を確認し、生成中のジョブにすぐ戻れます。',
      },
      pricing: {
        title: '料金プラン | ドヤSEO',
        description: `無料プランはゲスト1日${SEO_PRICING.guestLimit}回、ログイン後1日${SEO_PRICING.freeLimit}回まで。プロプランは1日${SEO_PRICING.proLimit}回まで。月額${SEO_PRICING.plans[1].priceLabel}。`,
      },
      guide: {
        title: '使い方 | ドヤSEO',
        description: 'ドヤSEOの使い方を解説。キーワード設計、アウトライン、生成のコツなど。',
      },
    },
  },
  
  // ドヤバナーAI
  banner: {
    title: 'ドヤバナーAI | AIでプロ品質バナーを自動生成',
    description: 'AIがあなたのビジネスに最適なバナーをA/B/Cの3案で提案。デザイン知識不要で効果的な広告バナーを素早く作成。',
    keywords: ['AIバナー生成', 'バナー作成', '広告バナー', 'ABテスト', 'デザイン自動化', 'Facebook広告', 'Instagram広告'],
    ogImage: '/og/banner.png',
    sections: {
      dashboard: {
        title: 'バナー生成 | ドヤバナーAI',
        description: 'カテゴリを選んでキーワードを入力するだけ。AIがA/B/Cの3案を自動生成。',
      },
      history: {
        title: '生成履歴 | ドヤバナーAI',
        description: '過去に生成したバナーの一覧。ダウンロード、再編集が可能。',
      },
      brand: {
        title: 'ブランド設定 | ドヤバナーAI',
        description: 'ロゴ、カラー、フォントを設定してブランドイメージに合ったバナーを生成。',
      },
      pricing: {
        title: '料金プラン | ドヤバナーAI',
        description: `無料プランはゲスト1日${BANNER_PRICING.guestLimit}回、ログイン後1日${BANNER_PRICING.freeLimit}回まで。プロプランは無制限に生成可能。月額${BANNER_PRICING.plans[1].priceLabel}。`,
      },
      guide: {
        title: '使い方ガイド | ドヤバナーAI',
        description: 'ドヤバナーAIの使い方を詳しく解説。カテゴリの選び方、キーワードのコツなど。',
      },
    },
  },
  
  // 管理画面
  admin: {
    title: '管理画面 | ドヤAIポータル',
    description: 'ドヤAIポータルの管理画面。ユーザー管理、統計、設定などを一元管理。',
    ogImage: '/og/portal.png',
  },
  
  // 認証
  auth: {
    signin: {
      title: 'ログイン | ドヤAIポータル',
      description: 'Googleアカウントでログインして、すべてのドヤAIサービスをご利用ください。',
    },
  },
}

// 構造化データ（JSON-LD）
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ドヤAI',
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SITE_CONFIG.description,
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`,
    ],
  }
}

export function generateSoftwareApplicationSchema(service: 'seo' | 'banner' | 'kantan') {
  const seo = SERVICE_SEO[service]
  const pricing = service === 'seo' ? SEO_PRICING : service === 'banner' ? BANNER_PRICING : KANTAN_PRICING
  
  const serviceData = {
    seo: {
      name: 'ドヤSEO',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
    banner: {
      name: 'ドヤバナーAI',
      applicationCategory: 'DesignApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
    kantan: {
      name: 'カンタンドヤAI',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    ...serviceData[service],
    operatingSystem: 'Web',
    url: `${SITE_CONFIG.url}/${service}`,
    description: seo.description,
  }
}

// OGP画像URL生成
export function getOgImageUrl(path?: string): string {
  if (path) {
    return `${SITE_CONFIG.url}${path}`
  }
  return `${SITE_CONFIG.url}/og/portal.png`
}

// ページタイトル生成
export function generatePageTitle(title: string, suffix = true): string {
  if (suffix) {
    return `${title} | ${SITE_CONFIG.name}`
  }
  return title
}
