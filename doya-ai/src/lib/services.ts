// ドヤAIポータル サービス定義
// 各サービスは独立したログイン・課金体系を持つ

export interface Service {
  id: string
  name: string
  description: string
  icon: string
  color: string
  gradient: string
  href: string
  features: string[]
  pricing: {
    free: { name: string; limit: string; price: number }
    pro: { name: string; limit: string; price: number }
  }
}

export const SERVICES: Service[] = [
  {
    id: 'kantan',
    name: 'カンタンドヤAI',
    description: 'ビジネス文章をAIが自動生成。メール、ブログ、SNS投稿など68種類のテンプレート。',
    icon: '📝',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    href: '/kantan',
    features: [
      '68種類のテンプレート',
      'ビジネスメール自動生成',
      'ブログ記事作成',
      'SNS投稿文作成',
      'キャッチコピー生成',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日3回まで', price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', price: 2980 },
    },
  },
  {
    id: 'banner',
    name: 'ドヤバナーAI',
    description: 'プロ品質のバナーをワンボタンで自動生成。A/B/Cの3案を同時生成。',
    icon: '🎨',
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    href: '/banner',
    features: [
      'A/B/C 3案同時生成',
      '10種類の業界テンプレート',
      '6種類のサイズプリセット',
      'ブランドカラー設定',
      '高品質PNG出力',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日1枚まで', price: 0 },
      pro: { name: 'プロプラン', limit: '無制限', price: 9980 },
    },
  },
]

export function getServiceById(id: string): Service | undefined {
  return SERVICES.find(service => service.id === id)
}

