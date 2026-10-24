// バナー管理システム
// 本番環境ではデータベースに保存しますが、デモ用にローカルストレージを使用

export interface Banner {
  id: string
  title: string
  description: string
  imageUrl: string
  linkUrl: string
  linkText: string
  isActive: boolean
  position: 'dashboard_top' | 'dashboard_side' | 'template_list' | 'after_generation'
  backgroundColor: string
  textColor: string
  priority: number
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

const BANNERS_KEY = 'doya_admin_banners'

// デフォルトバナー（ドヤマーケ宣伝）
const defaultBanners: Banner[] = [
  {
    id: 'doyamarke-main',
    title: '無料テンプレートをダウンロード！',
    description: 'ドヤマーケで使える無料のビジネステンプレートをプレゼント中。仕事をさらにスピードアップ！',
    imageUrl: '/images/banners/doyamarke-banner.jpg',
    linkUrl: 'https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1',
    linkText: '無料でもらう',
    isActive: true,
    position: 'dashboard_top',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: '#ffffff',
    priority: 1,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'doyamarke-side',
    title: 'もっと仕事を楽にしたい？',
    description: 'ドヤマーケには、仕事が爆速になるツールやテンプレートが盛りだくさん！',
    imageUrl: '',
    linkUrl: 'https://doyamarke.surisuta.jp',
    linkText: 'サイトを見る',
    isActive: true,
    position: 'dashboard_side',
    backgroundColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    textColor: '#ffffff',
    priority: 2,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'doyamarke-template',
    title: '生成したコンテンツを活用しませんか？',
    description: 'DOYA-AIで作成した文章を、さらにブラッシュアップして使えるテンプレートがあります！',
    imageUrl: '',
    linkUrl: 'https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1',
    linkText: 'テンプレートを見る',
    isActive: true,
    position: 'after_generation',
    backgroundColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    textColor: '#ffffff',
    priority: 3,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campaign-1',
    title: 'ドヤマーケ会員登録で特典ゲット！',
    description: '無料会員登録で、すぐに使えるビジネステンプレートをプレゼント！',
    imageUrl: '',
    linkUrl: 'https://doyamarke.surisuta.jp',
    linkText: '無料登録する',
    isActive: false,
    position: 'dashboard_top',
    backgroundColor: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    textColor: '#333333',
    priority: 0,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// バナー一覧を取得
export function getBanners(): Banner[] {
  if (typeof window === 'undefined') return defaultBanners
  
  const stored = localStorage.getItem(BANNERS_KEY)
  if (!stored) {
    // 初回はデフォルトバナーを保存
    localStorage.setItem(BANNERS_KEY, JSON.stringify(defaultBanners))
    return defaultBanners
  }
  
  return JSON.parse(stored)
}

// 特定のポジションのアクティブなバナーを取得
export function getActiveBanners(position: Banner['position']): Banner[] {
  const banners = getBanners()
  const now = new Date()
  
  return banners
    .filter((banner) => {
      if (!banner.isActive) return false
      if (banner.position !== position) return false
      
      // 期間チェック
      if (banner.startDate && new Date(banner.startDate) > now) return false
      if (banner.endDate && new Date(banner.endDate) < now) return false
      
      return true
    })
    .sort((a, b) => a.priority - b.priority)
}

// バナーを保存
export function saveBanners(banners: Banner[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BANNERS_KEY, JSON.stringify(banners))
}

// バナーを追加
export function addBanner(banner: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>): Banner {
  const banners = getBanners()
  const newBanner: Banner = {
    ...banner,
    id: `banner-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  banners.push(newBanner)
  saveBanners(banners)
  return newBanner
}

// バナーを更新
export function updateBanner(id: string, updates: Partial<Banner>): Banner | null {
  const banners = getBanners()
  const index = banners.findIndex((b) => b.id === id)
  
  if (index === -1) return null
  
  banners[index] = {
    ...banners[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  
  saveBanners(banners)
  return banners[index]
}

// バナーを削除
export function deleteBanner(id: string): boolean {
  const banners = getBanners()
  const filtered = banners.filter((b) => b.id !== id)
  
  if (filtered.length === banners.length) return false
  
  saveBanners(filtered)
  return true
}

// バナーの有効/無効を切り替え
export function toggleBannerActive(id: string): Banner | null {
  const banners = getBanners()
  const banner = banners.find((b) => b.id === id)
  
  if (!banner) return null
  
  return updateBanner(id, { isActive: !banner.isActive })
}

