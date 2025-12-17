/**
 * サービス定義とAPI接続
 */

export interface ServiceConfig {
  id: string
  name: string
  shortName: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  apiUrl: string
  dashboardUrl: string
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 'kantan-doya',
    name: 'カンタンドヤAI',
    shortName: 'ドヤAI',
    description: 'AI文章生成ツール - 68種類のテンプレートで文章作成を加速',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '✨',
    apiUrl: process.env.KANTAN_DOYA_API_URL || 'http://localhost:3000',
    dashboardUrl: '/kantan-doya',
  },
  {
    id: 'doya-banner',
    name: 'ドヤバナーAI',
    shortName: 'バナーAI',
    description: 'AIバナー生成ツール - ワンボタンでプロ品質バナー',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: '🎨',
    apiUrl: process.env.DOYA_BANNER_API_URL || 'http://localhost:3001',
    dashboardUrl: '/doya-banner',
  },
]

export interface ServiceStats {
  totalUsers: number
  activeUsers: number
  todayGenerations: number
  totalGenerations: number
  revenue: number
  proUsers: number
}

export interface RecentActivity {
  id: string
  type: 'generation' | 'signup' | 'upgrade' | 'error'
  message: string
  userId?: string
  userName?: string
  timestamp: string
}

/**
 * サービスの統計を取得（モック）
 */
export async function fetchServiceStats(serviceId: string): Promise<ServiceStats> {
  // 実際にはAPIから取得
  // const service = SERVICES.find(s => s.id === serviceId)
  // const response = await fetch(`${service?.apiUrl}/api/admin/stats`)
  
  // モックデータ
  await new Promise(resolve => setTimeout(resolve, 500))
  
  if (serviceId === 'kantan-doya') {
    return {
      totalUsers: 1234,
      activeUsers: 456,
      todayGenerations: 789,
      totalGenerations: 45678,
      revenue: 298000,
      proUsers: 89,
    }
  } else {
    return {
      totalUsers: 567,
      activeUsers: 123,
      todayGenerations: 234,
      totalGenerations: 12345,
      revenue: 159200,
      proUsers: 42,
    }
  }
}

/**
 * 最近のアクティビティを取得（モック）
 */
export async function fetchRecentActivities(serviceId: string): Promise<RecentActivity[]> {
  await new Promise(resolve => setTimeout(resolve, 300))
  
  const now = Date.now()
  
  if (serviceId === 'kantan-doya') {
    return [
      { id: '1', type: 'generation', message: 'ビジネスメールを生成', userName: '田中太郎', timestamp: new Date(now - 1000 * 60 * 2).toISOString() },
      { id: '2', type: 'signup', message: '新規ユーザー登録', userName: '山田花子', timestamp: new Date(now - 1000 * 60 * 5).toISOString() },
      { id: '3', type: 'upgrade', message: 'プレミアムにアップグレード', userName: '佐藤一郎', timestamp: new Date(now - 1000 * 60 * 15).toISOString() },
      { id: '4', type: 'generation', message: 'ブログ記事を生成', userName: '鈴木美咲', timestamp: new Date(now - 1000 * 60 * 20).toISOString() },
      { id: '5', type: 'generation', message: 'キャッチコピーを生成', userName: '高橋健太', timestamp: new Date(now - 1000 * 60 * 30).toISOString() },
    ]
  } else {
    return [
      { id: '1', type: 'generation', message: '格安SIMバナーを生成', userName: '木村拓也', timestamp: new Date(now - 1000 * 60 * 3).toISOString() },
      { id: '2', type: 'generation', message: 'ECセールバナーを生成', userName: '渡辺真理', timestamp: new Date(now - 1000 * 60 * 8).toISOString() },
      { id: '3', type: 'signup', message: '新規ユーザー登録', userName: '伊藤誠', timestamp: new Date(now - 1000 * 60 * 12).toISOString() },
      { id: '4', type: 'upgrade', message: 'プロプランにアップグレード', userName: '中村愛', timestamp: new Date(now - 1000 * 60 * 25).toISOString() },
      { id: '5', type: 'error', message: '生成エラー発生', timestamp: new Date(now - 1000 * 60 * 45).toISOString() },
    ]
  }
}

/**
 * 全サービスの統計を取得
 */
export async function fetchAllServicesStats(): Promise<Record<string, ServiceStats>> {
  const results: Record<string, ServiceStats> = {}
  
  for (const service of SERVICES) {
    results[service.id] = await fetchServiceStats(service.id)
  }
  
  return results
}

/**
 * サービスを取得
 */
export function getService(serviceId: string): ServiceConfig | undefined {
  return SERVICES.find(s => s.id === serviceId)
}

