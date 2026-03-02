'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { 
  Send, Paperclip, MoreHorizontal, Sparkles, LogIn,
  FileText, Target, TrendingUp, Users, BarChart3, Lightbulb,
  Home, Cpu, Clock, Settings, HelpCircle, DollarSign,
  MessageSquare, Rocket, Bot, User, Loader2, ChevronRight, Star,
  Megaphone, PenTool, Mail, Search, Share2, ShoppingCart, Globe,
  Zap, BookOpen, Heart, Palette, Video, Mic, Camera, Gift,
  Building, Briefcase, Award, Headphones, Shield, Layers, ArrowLeft, UserCircle,
  Menu, X
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// サイドバーメニュー - AIエージェント中心に再構成
const SIDEBAR_MENU = [
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat', active: true },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'plan', label: 'プラン・料金', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/pricing' },
]

// チャットカテゴリ（課題解決テンプレート）- 全24カテゴリ
const CHAT_CATEGORIES = [
  // ==================== 広告・集客 ====================
  {
    id: 'ad-optimization',
    title: '広告運用最適化',
    description: 'Google/Meta広告のパフォーマンス改善策を提案。',
    icon: <Megaphone className="w-6 h-6" />,
    color: 'bg-red-500',
    category: '広告・集客',
    prompt: '広告運用の最適化について相談させてください。',
  },
  {
    id: 'target-analysis',
    title: 'ターゲット分析',
    description: '顧客データから最適なターゲットと次の一手を提案。',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-purple-500',
    category: '広告・集客',
    prompt: 'ターゲット顧客の分析と戦略提案をお願いします。',
  },
  {
    id: 'lp-improvement',
    title: 'LP改善アドバイス',
    description: 'CVR向上のためのランディングページ改善点を提案。',
    icon: <Layers className="w-6 h-6" />,
    color: 'bg-orange-500',
    category: '広告・集客',
    prompt: 'ランディングページの改善点を教えてください。',
  },
  {
    id: 'keyword-strategy',
    title: 'キーワード戦略',
    description: 'SEO/リスティングのキーワード選定をサポート。',
    icon: <Search className="w-6 h-6" />,
    color: 'bg-teal-500',
    category: '広告・集客',
    prompt: 'キーワード戦略について相談させてください。',
  },

  // ==================== SNS・コンテンツ ====================
  {
    id: 'sns-strategy',
    title: 'SNS運用戦略',
    description: 'Instagram/Twitter/TikTokの運用方針を立案。',
    icon: <Share2 className="w-6 h-6" />,
    color: 'bg-pink-500',
    category: 'SNS・コンテンツ',
    prompt: 'SNS運用戦略について相談させてください。',
  },
  {
    id: 'content-planning',
    title: 'コンテンツ企画',
    description: 'ブログ・動画・SNSのコンテンツ企画をサポート。',
    icon: <PenTool className="w-6 h-6" />,
    color: 'bg-indigo-500',
    category: 'SNS・コンテンツ',
    prompt: 'コンテンツ企画について相談させてください。',
  },
  {
    id: 'video-marketing',
    title: '動画マーケティング',
    description: 'YouTube/TikTok/Reelsの動画戦略を提案。',
    icon: <Video className="w-6 h-6" />,
    color: 'bg-red-600',
    category: 'SNS・コンテンツ',
    prompt: '動画マーケティングについて相談させてください。',
  },
  {
    id: 'influencer-marketing',
    title: 'インフルエンサー施策',
    description: 'インフルエンサー選定と施策設計をアドバイス。',
    icon: <Camera className="w-6 h-6" />,
    color: 'bg-violet-500',
    category: 'SNS・コンテンツ',
    prompt: 'インフルエンサーマーケティングについて相談させてください。',
  },

  // ==================== 営業・セールス ====================
  {
    id: 'sales-strategy',
    title: '営業戦略提案',
    description: '営業実績を分析し、売上向上への具体的な戦略を提案。',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'bg-emerald-500',
    category: '営業・セールス',
    prompt: '営業戦略の立案を手伝ってください。',
  },
  {
    id: 'customer-docs',
    title: '顧客対応文書',
    description: '営業メールや報告書をデータに基づき自動作成。',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-blue-500',
    category: '営業・セールス',
    prompt: '営業メールや報告書の作成を手伝ってください。',
  },
  {
    id: 'proposal-creation',
    title: '提案書作成サポート',
    description: '顧客を動かす提案書の構成と内容をアドバイス。',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'bg-cyan-500',
    category: '営業・セールス',
    prompt: '提案書作成について相談させてください。',
  },
  {
    id: 'objection-handling',
    title: '反論対応トーク',
    description: 'よくある反論への効果的な切り返しを提案。',
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-amber-500',
    category: '営業・セールス',
    prompt: '営業での反論対応について相談させてください。',
  },

  // ==================== 分析・戦略 ====================
  {
    id: 'market-analysis',
    title: '市場分析',
    description: '業界トレンドと市場機会を分析してレポート。',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'bg-blue-600',
    category: '分析・戦略',
    prompt: '市場分析について相談させてください。',
  },
  {
    id: 'competitor-analysis',
    title: '競合分析',
    description: '競合他社の強み・弱みを分析して差別化策を提案。',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-slate-600',
    category: '分析・戦略',
    prompt: '競合分析について相談させてください。',
  },
  {
    id: 'persona-creation',
    title: 'ペルソナ設計',
    description: '理想的な顧客像を詳細に設計してマーケティングに活用。',
    icon: <User className="w-6 h-6" />,
    color: 'bg-green-500',
    category: '分析・戦略',
    prompt: 'ペルソナ設計について相談させてください。',
  },
  {
    id: 'kpi-setting',
    title: 'KPI設計',
    description: '効果測定のためのKPI設計と目標設定をサポート。',
    icon: <Award className="w-6 h-6" />,
    color: 'bg-yellow-500',
    category: '分析・戦略',
    prompt: 'KPIの設計について相談させてください。',
  },

  // ==================== ブランディング ====================
  {
    id: 'brand-strategy',
    title: 'ブランド戦略',
    description: 'ブランドポジショニングとメッセージングを設計。',
    icon: <Palette className="w-6 h-6" />,
    color: 'bg-fuchsia-500',
    category: 'ブランディング',
    prompt: 'ブランド戦略について相談させてください。',
  },
  {
    id: 'naming-copy',
    title: 'ネーミング・コピー',
    description: '商品名やキャッチコピーのアイデアを提案。',
    icon: <Lightbulb className="w-6 h-6" />,
    color: 'bg-lime-500',
    category: 'ブランディング',
    prompt: 'ネーミングやコピーについて相談させてください。',
  },
  {
    id: 'pr-strategy',
    title: 'PR・広報戦略',
    description: 'プレスリリースやメディア露出の戦略を立案。',
    icon: <Mic className="w-6 h-6" />,
    color: 'bg-rose-500',
    category: 'ブランディング',
    prompt: 'PR・広報戦略について相談させてください。',
  },

  // ==================== EC・CRM ====================
  {
    id: 'ec-strategy',
    title: 'EC売上改善',
    description: 'ECサイトの売上向上施策を提案。',
    icon: <ShoppingCart className="w-6 h-6" />,
    color: 'bg-orange-600',
    category: 'EC・CRM',
    prompt: 'ECサイトの売上改善について相談させてください。',
  },
  {
    id: 'crm-strategy',
    title: 'CRM・リピート施策',
    description: '顧客ロイヤルティ向上とリピート率改善を提案。',
    icon: <Heart className="w-6 h-6" />,
    color: 'bg-pink-600',
    category: 'EC・CRM',
    prompt: 'CRM戦略とリピート施策について相談させてください。',
  },
  {
    id: 'email-marketing',
    title: 'メールマーケティング',
    description: 'メルマガ・ステップメールの戦略と改善を提案。',
    icon: <Mail className="w-6 h-6" />,
    color: 'bg-sky-500',
    category: 'EC・CRM',
    prompt: 'メールマーケティングについて相談させてください。',
  },
  {
    id: 'campaign-planning',
    title: 'キャンペーン企画',
    description: 'セール・プロモーションの企画をサポート。',
    icon: <Gift className="w-6 h-6" />,
    color: 'bg-red-400',
    category: 'EC・CRM',
    prompt: 'キャンペーン企画について相談させてください。',
  },

  // ==================== その他 ====================
  {
    id: 'global-marketing',
    title: '海外マーケティング',
    description: '海外展開・越境ECのマーケティング戦略を提案。',
    icon: <Globe className="w-6 h-6" />,
    color: 'bg-teal-600',
    category: 'その他',
    prompt: '海外マーケティングについて相談させてください。',
  },
  {
    id: 'btob-marketing',
    title: 'BtoBマーケティング',
    description: '法人向けマーケティングとリードジェネレーション。',
    icon: <Building className="w-6 h-6" />,
    color: 'bg-slate-500',
    category: 'その他',
    prompt: 'BtoBマーケティングについて相談させてください。',
  },
  {
    id: 'cs-improvement',
    title: 'カスタマーサポート改善',
    description: 'CS対応の効率化と顧客満足度向上を提案。',
    icon: <Headphones className="w-6 h-6" />,
    color: 'bg-green-600',
    category: 'その他',
    prompt: 'カスタマーサポートの改善について相談させてください。',
  },
  {
    id: 'marketing-automation',
    title: 'マーケ自動化',
    description: 'MA・自動化ツールの導入と活用をアドバイス。',
    icon: <Zap className="w-6 h-6" />,
    color: 'bg-amber-600',
    category: 'その他',
    prompt: 'マーケティング自動化について相談させてください。',
  },
  {
    id: 'learning-support',
    title: 'マーケ学習サポート',
    description: 'マーケティングの基礎から応用まで学習をサポート。',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'bg-indigo-600',
    category: 'その他',
    prompt: 'マーケティングについて学びたいです。',
  },
]

// カテゴリグループ
const CATEGORY_GROUPS = [
  { id: 'ad', name: '広告・集客', color: 'from-red-500 to-orange-500' },
  { id: 'sns', name: 'SNS・コンテンツ', color: 'from-pink-500 to-purple-500' },
  { id: 'sales', name: '営業・セールス', color: 'from-emerald-500 to-cyan-500' },
  { id: 'analysis', name: '分析・戦略', color: 'from-blue-500 to-indigo-500' },
  { id: 'brand', name: 'ブランディング', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'ec', name: 'EC・CRM', color: 'from-orange-500 to-red-500' },
  { id: 'other', name: 'その他', color: 'from-slate-500 to-gray-500' },
]

// チャットメッセージ型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function KantanChatPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [selectedCategory, setSelectedCategory] = useState<typeof CHAT_CATEGORIES[0] | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const isGuest = !session
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  // チャット末尾にスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // カテゴリ選択時
  const handleSelectCategory = (category: typeof CHAT_CATEGORIES[0]) => {
    setSelectedCategory(category)
    setMessages([
      {
        id: `msg-${Date.now()}-1`,
        role: 'assistant',
        content: `こんにちは！「${category.title}」の専門AIアシスタントです。🎯`,
        timestamp: new Date(),
      },
      {
        id: `msg-${Date.now()}-2`,
        role: 'assistant',
        content: getInitialPrompt(category.id),
        timestamp: new Date(),
      },
    ])
  }

  // カテゴリに応じた初期プロンプト
  function getInitialPrompt(categoryId: string): string {
    const prompts: Record<string, string> = {
      'ad-optimization': '広告運用についてお聞かせください。\n\n例えば：\n• 現在のCPAやROASを改善したい\n• 新しい広告チャネルを試したい\n• クリエイティブのA/Bテストがしたい\n\nどのような課題をお持ちですか？',
      'target-analysis': 'ターゲット分析についてお手伝いします。\n\n例えば：\n• ペルソナを作りたい\n• ターゲットを絞り込みたい\n• 顧客データを分析したい\n\n現在のターゲット像や課題を教えてください。',
      'lp-improvement': 'LP改善のアドバイスをいたします。\n\n例えば：\n• CVRを上げたい\n• ファーストビューを改善したい\n• CTAの配置を見直したい\n\n現在のLPのURLや課題を教えてください。',
      'keyword-strategy': 'キーワード戦略についてお手伝いします。\n\n例えば：\n• SEOのキーワード選定\n• リスティング広告のキーワード設計\n• ロングテールキーワードの発掘\n\nどのような目的でキーワード戦略を検討されていますか？',
      'sns-strategy': 'SNS運用戦略についてお手伝いします。\n\n例えば：\n• Instagram/Twitter/TikTokどれを始めるべき？\n• 投稿頻度やコンテンツの方針\n• フォロワー増加施策\n\n現在の状況と目標を教えてください。',
      'content-planning': 'コンテンツ企画をお手伝いします。\n\n例えば：\n• ブログ記事のネタ出し\n• SNS投稿の企画\n• 動画コンテンツの企画\n\nどのようなコンテンツを作りたいですか？',
      'video-marketing': '動画マーケティングについてお手伝いします。\n\n例えば：\n• YouTube/TikTok/Reelsの使い分け\n• 動画の企画・構成\n• 撮影・編集のコツ\n\nどのような動画を作りたいですか？',
      'influencer-marketing': 'インフルエンサー施策についてお手伝いします。\n\n例えば：\n• インフルエンサーの選び方\n• 依頼の仕方と報酬設計\n• 効果測定の方法\n\nどのような商品・サービスのPRを検討されていますか？',
      'sales-strategy': '営業戦略についてお手伝いします。\n\n例えば：\n• 新規開拓の方法\n• 成約率を上げたい\n• 営業プロセスの改善\n\n現在の課題や目標を教えてください。',
      'customer-docs': '顧客対応文書の作成をお手伝いします。\n\n例えば：\n• 営業メールの作成\n• 提案書・報告書の作成\n• お礼メール・フォローメール\n\nどのような文書を作成したいですか？',
      'proposal-creation': '提案書作成をサポートします。\n\n例えば：\n• 提案書の構成\n• 訴求ポイントの整理\n• 競合との差別化\n\n提案先の情報や商品・サービスについて教えてください。',
      'objection-handling': '反論対応のトークスクリプトを作成します。\n\n例えば：\n• 「高い」と言われた時の対応\n• 「検討します」への切り返し\n• 「他社と比較したい」への対応\n\nどのような反論に困っていますか？',
      'market-analysis': '市場分析をお手伝いします。\n\n例えば：\n• 市場規模の調査\n• 業界トレンドの把握\n• 参入障壁の分析\n\nどの市場・業界について知りたいですか？',
      'competitor-analysis': '競合分析をお手伝いします。\n\n例えば：\n• 競合の強み・弱み分析\n• ポジショニングマップ作成\n• 差別化戦略の立案\n\n自社と競合について教えてください。',
      'persona-creation': 'ペルソナ設計をお手伝いします。\n\n例えば：\n• 理想的な顧客像の定義\n• 購買行動の分析\n• ペインポイントの特定\n\n商品・サービスについて教えてください。',
      'kpi-setting': 'KPI設計をお手伝いします。\n\n例えば：\n• 適切なKPIの選定\n• 目標値の設定\n• 測定方法の設計\n\nどのような目標を達成したいですか？',
      'brand-strategy': 'ブランド戦略についてお手伝いします。\n\n例えば：\n• ブランドポジショニング\n• ブランドメッセージの策定\n• ブランドガイドライン\n\n現在のブランドについて教えてください。',
      'naming-copy': 'ネーミング・コピー作成をお手伝いします。\n\n例えば：\n• 商品名・サービス名のアイデア\n• キャッチコピーの作成\n• タグラインの策定\n\n何のネーミング・コピーを作りたいですか？',
      'pr-strategy': 'PR・広報戦略についてお手伝いします。\n\n例えば：\n• プレスリリースの作成\n• メディアアプローチ\n• 広報計画の立案\n\nどのような情報を発信したいですか？',
      'ec-strategy': 'EC売上改善についてお手伝いします。\n\n例えば：\n• CVRの改善\n• カート離脱の防止\n• 客単価アップ施策\n\n現在のEC運営の課題を教えてください。',
      'crm-strategy': 'CRM・リピート施策についてお手伝いします。\n\n例えば：\n• リピート率の向上\n• 会員プログラムの設計\n• 顧客ロイヤルティ向上\n\n現在の顧客データや課題を教えてください。',
      'email-marketing': 'メールマーケティングについてお手伝いします。\n\n例えば：\n• メルマガの企画・改善\n• ステップメールの設計\n• 開封率・クリック率の改善\n\n現在のメール施策について教えてください。',
      'campaign-planning': 'キャンペーン企画をお手伝いします。\n\n例えば：\n• セール・プロモーションの企画\n• 特典・インセンティブ設計\n• 告知・集客方法\n\nどのようなキャンペーンを企画したいですか？',
      'global-marketing': '海外マーケティングについてお手伝いします。\n\n例えば：\n• 海外市場への参入戦略\n• 越境ECの始め方\n• 現地向けマーケティング\n\nどの国・地域への展開を検討されていますか？',
      'btob-marketing': 'BtoBマーケティングについてお手伝いします。\n\n例えば：\n• リードジェネレーション\n• ホワイトペーパー・ウェビナー\n• ABM（アカウントベースドマーケティング）\n\n現在のBtoBマーケティングの課題を教えてください。',
      'cs-improvement': 'カスタマーサポート改善についてお手伝いします。\n\n例えば：\n• 問い合わせ対応の効率化\n• FAQ・ヘルプコンテンツの整備\n• 顧客満足度の向上\n\n現在のCS体制と課題を教えてください。',
      'marketing-automation': 'マーケティング自動化についてお手伝いします。\n\n例えば：\n• MAツールの選定\n• 自動化シナリオの設計\n• リードナーチャリング\n\n現在の課題や自動化したい業務を教えてください。',
      'learning-support': 'マーケティング学習をサポートします。\n\n例えば：\n• マーケティングの基礎知識\n• 最新トレンドの解説\n• 実践的なスキルアップ\n\n何について学びたいですか？',
    }
    return prompts[categoryId] || 'どのようなことでお困りですか？具体的な状況や課題を教えてください。'
  }

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // マーケティング課題解決用のプロンプト
      const systemContext = selectedCategory 
        ? `あなたはマーケティングの専門家です。「${selectedCategory.title}」に関する相談に対応しています。`
        : 'あなたはマーケティングの専門家です。';

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'chat-refinement',
          inputs: {
            prompt: `${systemContext}

以下のユーザーからの相談に対して、具体的で実践的なアドバイスを日本語で提供してください。

ユーザーの相談:
${inputValue}

【回答のポイント】
- 具体的なアクションプランを提示
- 数値目標があれば示す
- 必要に応じて事例を交える
- 簡潔かつ分かりやすく`,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.output,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* モバイルオーバーレイ */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside className={`
        w-64 lg:w-52 bg-[#3B5998] text-white flex flex-col fixed h-full z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* ロゴ */}
        <div className="p-5 flex items-center justify-between">
          <Link href="/kantan" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">カンタンマーケ</span>
          </Link>
          <button 
            className="lg:hidden p-1 hover:bg-white/10 rounded"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* メインメニュー */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {SIDEBAR_MENU.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                    item.active
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* データベースセクション */}
          <div className="mt-6">
            <p className="px-3 text-xs text-white/50 uppercase tracking-wider mb-2">データベース</p>
            <ul className="space-y-1">
              {SIDEBAR_DATA_MENU.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 他サービス */}
        <div className="p-3 border-t border-white/10">
          <Link href="/banner" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🎨</span>
            <span>ドヤバナーAI</span>
          </Link>
          <Link href="/seo" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🧠</span>
            <span>ドヤライティングAI</span>
          </Link>
        </div>

        {/* ロゴマーク */}
        <div className="p-4 text-white/30 text-xs">
          @カンタンマーケAI
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-52 flex flex-col h-screen">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 lg:px-8 h-16 flex items-center justify-between">
            {/* モバイルメニューボタン */}
            <button 
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <h1 className="text-lg lg:text-xl font-bold text-gray-800">AIチャット</h1>
            
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-gray-800">{userName}</div>
                  <div className="text-xs text-gray-400">Admin</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* チャットエリア */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 lg:p-8">
          {/* カテゴリ選択 */}
          {!selectedCategory ? (
            <div className="flex-1 overflow-y-auto">
              {/* ヘッダー */}
              <div className="mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-2xl font-bold text-gray-800 mb-1 lg:mb-2">
                  💬 マーケティング課題を解決
                </h2>
                <p className="text-sm lg:text-base text-gray-500">
                  相談したいカテゴリを選択してください（全{CHAT_CATEGORIES.length}カテゴリ）
                </p>
              </div>

              {/* 検索バー */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="カテゴリを検索..."
                    className="w-full pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 bg-white border border-gray-200 rounded-lg lg:rounded-xl text-gray-800 text-sm placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {/* カテゴリグループタブ */}
              <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-4 lg:mb-6 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all whitespace-nowrap ${
                    selectedGroup === null
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  すべて
                </button>
                {CATEGORY_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group.name)}
                    className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all whitespace-nowrap ${
                      selectedGroup === group.name
                        ? `bg-gradient-to-r ${group.color} text-white`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>

              {/* カテゴリグリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-8">
                {CHAT_CATEGORIES
                  .filter((category) => {
                    // 検索フィルター
                    if (searchQuery) {
                      const query = searchQuery.toLowerCase()
                      return (
                        category.title.toLowerCase().includes(query) ||
                        category.description.toLowerCase().includes(query)
                      )
                    }
                    // グループフィルター
                    if (selectedGroup) {
                      return category.category === selectedGroup
                    }
                    return true
                  })
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleSelectCategory(category)}
                      className="group text-left p-3 lg:p-5 bg-white rounded-xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all"
                    >
                      <div className={`w-9 h-9 lg:w-11 lg:h-11 ${category.color} rounded-lg lg:rounded-xl flex items-center justify-center text-white mb-2 lg:mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                        <span className="scale-75 lg:scale-100">{category.icon}</span>
                      </div>
                      <h3 className="font-bold text-gray-800 mb-0.5 lg:mb-1 text-xs lg:text-sm group-hover:text-blue-600 transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-[10px] lg:text-xs text-gray-500 line-clamp-2">{category.description}</p>
                      <div className="mt-2 lg:mt-3 flex items-center text-[10px] lg:text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>相談を始める</span>
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </div>
                    </button>
                  ))}
              </div>

              {/* フィルター結果が0件の場合 */}
              {CHAT_CATEGORIES.filter((category) => {
                if (searchQuery) {
                  const query = searchQuery.toLowerCase()
                  return (
                    category.title.toLowerCase().includes(query) ||
                    category.description.toLowerCase().includes(query)
                  )
                }
                if (selectedGroup) {
                  return category.category === selectedGroup
                }
                return true
              }).length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">該当するカテゴリが見つかりません</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 選択中のカテゴリ */}
              <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-100 shadow-sm mb-3 lg:mb-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-3 lg:p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <button 
                      onClick={() => {
                        setSelectedCategory(null)
                        setMessages([])
                      }}
                      className="p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
                    </button>
                    <div className={`w-8 h-8 lg:w-10 lg:h-10 ${selectedCategory.color} rounded-lg lg:rounded-xl flex items-center justify-center text-white shadow-lg`}>
                      <span className="scale-75 lg:scale-100">{selectedCategory.icon}</span>
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-800 text-sm lg:text-base">{selectedCategory.title}</h2>
                      <p className="text-[10px] lg:text-xs text-gray-500">{selectedCategory.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] lg:text-xs text-gray-400 hidden sm:inline">{messages.length}メッセージ</span>
                    <button 
                      onClick={() => {
                        setSelectedCategory(null)
                        setMessages([])
                      }}
                      className="p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <MoreHorizontal className="w-4 h-4 lg:w-5 lg:h-5" />
                    </button>
                  </div>
                </div>

                {/* チャットメッセージ */}
                <div className="p-3 lg:p-6 flex-1 overflow-y-auto">
                  <div className="space-y-3 lg:space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] lg:max-w-[70%] ${
                          msg.role === 'user' 
                            ? 'bg-blue-500 text-white rounded-xl lg:rounded-2xl rounded-br-md px-3 lg:px-5 py-2 lg:py-3' 
                            : 'bg-gray-100 text-gray-800 rounded-xl lg:rounded-2xl rounded-bl-md px-3 lg:px-5 py-2 lg:py-3'
                        }`}>
                          <p className="whitespace-pre-wrap text-xs lg:text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 rounded-xl lg:rounded-2xl rounded-bl-md px-3 lg:px-5 py-2 lg:py-3">
                          <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-blue-500" />
                        </div>
                      </div>
                    )}
                    
                    <div ref={chatEndRef} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 入力エリア */}
          {selectedCategory && (
            <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-200 shadow-sm p-3 lg:p-4">
              <div className="flex items-center gap-2 lg:gap-3">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter は改行。送信は Ctrl/⌘+Enter のみ。
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="入力（Enter=改行 / Ctrl+Enter or ⌘+Enter=送信）"
                  rows={2}
                  className="flex-1 bg-transparent text-gray-800 text-sm placeholder-gray-400 outline-none resize-none"
                  disabled={isLoading}
                />
                <button className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-5 py-2 lg:py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg lg:rounded-xl transition-colors"
                >
                  <span className="hidden sm:inline">送信</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ゲストバナー */}
          {isGuest && (
            <div className="mt-3 lg:mt-4 p-3 lg:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl lg:rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 lg:gap-3">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  <p className="text-xs lg:text-sm text-gray-700">
                    🆓 お試しモード：残り <strong className="text-blue-600">{guestRemainingCount}回</strong>
                  </p>
                </div>
                <Link href="/auth/signin?service=kantan">
                  <button className="w-full sm:w-auto px-3 lg:px-4 py-1.5 lg:py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs lg:text-sm font-medium rounded-lg transition-colors">
                    ログインで10回/日に！
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

