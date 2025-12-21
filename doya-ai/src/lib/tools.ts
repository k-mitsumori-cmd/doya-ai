// ドヤAI ツール一覧
// services.ts と連携して使用

export interface Tool {
  id: string
  name: string
  description: string
  icon: string
  color: string
  href: string
  isNew?: boolean
  comingSoon?: boolean
}

export const TOOLS: Tool[] = [
  {
    id: 'kantan',
    name: 'カンタンドヤAI',
    description: 'メール、ブログ、SNS投稿など68種類のテンプレート',
    icon: '📝',
    color: 'from-blue-500 to-cyan-500',
    href: '/kantan/dashboard',
  },
  {
    id: 'banner',
    name: 'Bunridge AI',
    description: 'プロ品質のバナーをワンボタンで自動生成',
    icon: '🎨',
    color: 'from-purple-500 to-pink-500',
    href: '/banner/dashboard',
    isNew: true,
  },
  {
    id: 'lp',
    name: 'ドヤLP AI',
    description: 'ランディングページを簡単に作成',
    icon: '🖥️',
    color: 'from-green-500 to-emerald-500',
    href: '/lp/dashboard',
    comingSoon: true,
  },
  {
    id: 'video',
    name: 'ドヤ動画AI',
    description: 'YouTube・TikTok用の台本を自動生成',
    icon: '🎬',
    color: 'from-red-500 to-orange-500',
    href: '/video/dashboard',
    comingSoon: true,
  },
  {
    id: 'presentation',
    name: 'ドヤプレゼンAI',
    description: 'パワーポイント用の構成を自動生成',
    icon: '📊',
    color: 'from-yellow-500 to-amber-500',
    href: '/presentation/dashboard',
    comingSoon: true,
  },
]

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find(tool => tool.id === id)
}

export function getActiveTools(): Tool[] {
  return TOOLS.filter(tool => !tool.comingSoon)
}

export function getComingSoonTools(): Tool[] {
  return TOOLS.filter(tool => tool.comingSoon)
}
