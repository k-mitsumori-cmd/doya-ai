// カンタンドヤAI ツール一覧
// 新しいツールはここに追加するだけで自動的にダッシュボードとサイドバーに表示されます

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
    id: 'text',
    name: '文章生成',
    description: 'メール、ブログ、SNS投稿など68種類のテンプレート',
    icon: '📝',
    color: 'from-blue-500 to-blue-600',
    href: '/dashboard/text',
  },
  {
    id: 'banner',
    name: 'バナー生成',
    description: 'プロ品質のバナーをワンボタンで自動生成',
    icon: '🎨',
    color: 'from-purple-500 to-pink-500',
    href: '/dashboard/banner',
    isNew: true,
  },
  {
    id: 'lp',
    name: 'LP作成',
    description: 'ランディングページを簡単に作成',
    icon: '🖥️',
    color: 'from-green-500 to-emerald-500',
    href: '/dashboard/lp',
    comingSoon: true,
  },
  {
    id: 'video',
    name: '動画台本',
    description: 'YouTube・TikTok用の台本を自動生成',
    icon: '🎬',
    color: 'from-red-500 to-orange-500',
    href: '/dashboard/video',
    comingSoon: true,
  },
  {
    id: 'presentation',
    name: 'プレゼン資料',
    description: 'パワーポイント用の構成を自動生成',
    icon: '📊',
    color: 'from-yellow-500 to-amber-500',
    href: '/dashboard/presentation',
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

