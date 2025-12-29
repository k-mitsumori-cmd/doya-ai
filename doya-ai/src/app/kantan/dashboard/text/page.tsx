'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search, Sparkles, FileText, Lightbulb, BarChart3, Target, MessageSquare, TrendingUp, Users, PenTool, Mail, Megaphone, Layers, Briefcase, Palette, Globe, Zap, BookOpen, Settings, Scale, Languages, Edit3, Cpu, ChevronRight, Rocket, Clock, Star, CheckCircle2, Timer, Crown, Flame, Home, DollarSign, HelpCircle, UserCircle, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

// サイドバーメニュー - AIエージェント中心に再構成
const SIDEBAR_MENU = [
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text', active: true },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'plan', label: 'プラン・料金', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/pricing' },
]

// マーケティング中心の全AIエージェント一覧（時間削減効果付き）
const ALL_AGENTS = [
  // LP・Web制作
  { id: 'lp-full-text', name: 'LP構成案・テキスト作成', icon: <FileText className="w-5 h-5" />, category: 'LP・Web', desc: 'ファーストビューからCTAまで', gradient: 'from-cyan-400 via-cyan-500 to-teal-500', glow: 'shadow-cyan-500/40', timeSaved: '4時間', popular: true },
  { id: 'lp-headline', name: 'LPキャッチコピー', icon: <Sparkles className="w-5 h-5" />, category: 'LP・Web', desc: 'ファーストビュー用コピー10案', gradient: 'from-cyan-400 via-cyan-500 to-teal-500', glow: 'shadow-cyan-500/40', timeSaved: '45分', popular: true },
  
  // バナー・広告コピー
  { id: 'ab-test-copy', name: 'A/Bテスト用コピー', icon: <Layers className="w-5 h-5" />, category: 'バナー・広告', desc: '5つのアプローチで比較', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '30分', popular: true },
  { id: 'google-ad-title', name: 'Google広告タイトル', icon: <Target className="w-5 h-5" />, category: 'バナー・広告', desc: '高CTRタイトル10パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '1時間', popular: true },
  { id: 'google-ad-description', name: 'Google広告説明文', icon: <Target className="w-5 h-5" />, category: 'バナー・広告', desc: '90文字以内の説明文5案', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '40分' },
  { id: 'facebook-ad-copy', name: 'Facebook広告文', icon: <Megaphone className="w-5 h-5" />, category: 'バナー・広告', desc: 'FB広告用コピー3パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '50分' },
  { id: 'instagram-ad', name: 'Instagram広告文', icon: <Palette className="w-5 h-5" />, category: 'バナー・広告', desc: 'キャプション+ハッシュタグ', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '35分' },
  { id: 'twitter-ad', name: 'Twitter/X広告文', icon: <MessageSquare className="w-5 h-5" />, category: 'バナー・広告', desc: '140文字ツイート5パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40', timeSaved: '25分' },

  // 分析・リサーチ
  { id: 'persona-creation', name: 'ペルソナ作成', icon: <Users className="w-5 h-5" />, category: '分析', desc: '詳細な顧客ペルソナを生成', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40', timeSaved: '3時間', popular: true },
  { id: 'market-analysis', name: '市場分析レポート', icon: <TrendingUp className="w-5 h-5" />, category: '分析', desc: '市場規模・トレンド分析', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40', timeSaved: '5日' },
  { id: 'competitor-analysis', name: '競合分析レポート', icon: <BarChart3 className="w-5 h-5" />, category: '分析', desc: '競合の強み・弱みを整理', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40', timeSaved: '3日', popular: true },
  { id: 'swot-analysis', name: 'SWOT分析', icon: <BarChart3 className="w-5 h-5" />, category: '分析', desc: '強み・弱み・機会・脅威', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40', timeSaved: '2時間' },
  { id: 'user-journey', name: 'カスタマージャーニー', icon: <Users className="w-5 h-5" />, category: '分析', desc: '顧客体験を可視化', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40', timeSaved: '4時間' },

  // SNS運用
  { id: 'instagram-caption', name: 'Instagram投稿文', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: 'エンゲージUPキャプション', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '20分' },
  { id: 'twitter-thread', name: 'Twitter/Xスレッド', icon: <MessageSquare className="w-5 h-5" />, category: 'SNS', desc: 'バズりやすいスレッド', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '30分', popular: true },
  { id: 'tiktok-script', name: 'TikTok台本', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: 'バズる動画台本', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '45分' },
  { id: 'youtube-script', name: 'YouTube台本', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: '視聴維持率を意識した台本', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '2時間' },
  { id: 'linkedin-post', name: 'LinkedIn投稿文', icon: <Briefcase className="w-5 h-5" />, category: 'SNS', desc: 'ビジネス向け投稿', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '25分' },
  { id: 'sns-content-calendar', name: 'SNSコンテンツカレンダー', icon: <Layers className="w-5 h-5" />, category: 'SNS', desc: '1ヶ月分の投稿計画', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '5時間' },
  
  // ビジネス文書
  { id: 'business-email', name: 'ビジネスメール', icon: <Mail className="w-5 h-5" />, category: 'ビジネス文書', desc: '丁寧なメールを作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '15分', popular: true },
  { id: 'email-reply', name: 'メール返信', icon: <Mail className="w-5 h-5" />, category: 'ビジネス文書', desc: '受信メールへの返信', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '10分' },
  { id: 'meeting-agenda', name: '会議アジェンダ', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '効率的なアジェンダ', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '20分' },
  { id: 'meeting-minutes', name: '議事録', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '会議メモから議事録生成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '30分' },
  { id: 'proposal-document', name: '提案書', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '企画提案書を作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '2時間' },
  { id: 'report-weekly', name: '週次報告書', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '業務報告書を作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '30分' },
  { id: 'presentation-outline', name: 'プレゼン構成', icon: <Layers className="w-5 h-5" />, category: 'ビジネス文書', desc: 'スライド構成案', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40', timeSaved: '1時間' },

  // 記事・コンテンツ
  { id: 'blog-article', name: 'ブログ記事', icon: <PenTool className="w-5 h-5" />, category: 'コンテンツ', desc: 'SEOを意識した記事', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '3時間', popular: true },
  { id: 'article-outline', name: '記事構成案', icon: <FileText className="w-5 h-5" />, category: 'コンテンツ', desc: '見出し構成を自動生成', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '45分' },
  { id: 'seo-title-meta', name: 'SEOタイトル・メタ', icon: <Search className="w-5 h-5" />, category: 'コンテンツ', desc: 'CTR向上のタイトル案', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '30分' },
  { id: 'article-summary', name: '記事・論文要約', icon: <FileText className="w-5 h-5" />, category: 'コンテンツ', desc: '長い文章を要約', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '20分' },
  { id: 'press-release', name: 'プレスリリース', icon: <Globe className="w-5 h-5" />, category: 'コンテンツ', desc: 'PR TIMES形式で生成', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '2時間' },
  { id: 'newsletter', name: 'メルマガ', icon: <Mail className="w-5 h-5" />, category: 'コンテンツ', desc: '開封率UPのメール', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40', timeSaved: '1.5時間', popular: true },

  // 営業・セールス
  { id: 'sales-pitch', name: 'セールスピッチ', icon: <Zap className="w-5 h-5" />, category: '営業', desc: '商談で使えるピッチ', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40', timeSaved: '1時間' },
  { id: 'product-description', name: '商品説明文', icon: <FileText className="w-5 h-5" />, category: '営業', desc: '魅力的な商品説明', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40', timeSaved: '40分' },
  { id: 'sales-email', name: '営業メール', icon: <Mail className="w-5 h-5" />, category: '営業', desc: '新規開拓・フォローアップ', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40', timeSaved: '30分' },
  { id: 'objection-handling', name: '反論対応スクリプト', icon: <MessageSquare className="w-5 h-5" />, category: '営業', desc: '営業での反論対応', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40', timeSaved: '1時間' },
  { id: 'case-study', name: '導入事例', icon: <TrendingUp className="w-5 h-5" />, category: '営業', desc: '顧客成功事例を構成', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40', timeSaved: '2時間' },

  // クリエイティブ
  { id: 'catchcopy', name: 'キャッチコピー', icon: <Sparkles className="w-5 h-5" />, category: 'クリエイティブ', desc: 'インパクト重視の10案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40', timeSaved: '45分', popular: true },
  { id: 'naming', name: 'ネーミング', icon: <Lightbulb className="w-5 h-5" />, category: 'クリエイティブ', desc: '商品・サービス名20案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40', timeSaved: '1時間' },
  { id: 'slogan', name: 'スローガン・タグライン', icon: <Megaphone className="w-5 h-5" />, category: 'クリエイティブ', desc: 'ブランドタグライン10案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40', timeSaved: '50分' },
  { id: 'brand-story', name: 'ブランドストーリー', icon: <PenTool className="w-5 h-5" />, category: 'クリエイティブ', desc: '感情に訴えるストーリー', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40', timeSaved: '2時間' },

  // 企画・アイデア
  { id: 'brainstorm', name: 'ブレストアイデア出し', icon: <Lightbulb className="w-5 h-5" />, category: '企画', desc: 'アイデア30個を生成', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40', timeSaved: '1時間' },
  { id: 'business-plan', name: '新規事業企画書', icon: <TrendingUp className="w-5 h-5" />, category: '企画', desc: '事業計画の骨子', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40', timeSaved: '4時間' },
  { id: 'event-plan', name: 'イベント企画書', icon: <Layers className="w-5 h-5" />, category: '企画', desc: 'イベント企画の構成', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40', timeSaved: '3時間' },

  // 教育・研修
  { id: 'business-manual', name: '業務マニュアル', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '分かりやすいマニュアル', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40', timeSaved: '3時間' },
  { id: 'training-curriculum', name: '研修カリキュラム', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '研修プログラム設計', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40', timeSaved: '4時間' },
  { id: 'faq-creation', name: 'FAQ作成', icon: <MessageSquare className="w-5 h-5" />, category: '教育・研修', desc: 'よくある質問と回答', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40', timeSaved: '2時間' },
  { id: 'quiz-creation', name: 'テスト問題作成', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '理解度確認テスト', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40', timeSaved: '1.5時間' },

  // 人事・採用
  { id: 'job-posting', name: '求人票', icon: <Briefcase className="w-5 h-5" />, category: '人事', desc: '魅力的な求人票', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40', timeSaved: '1時間' },
  { id: 'interview-questions', name: '面接質問', icon: <Users className="w-5 h-5" />, category: '人事', desc: '採用面接用の質問', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40', timeSaved: '45分' },
  { id: 'evaluation-sheet', name: '人事評価シート', icon: <FileText className="w-5 h-5" />, category: '人事', desc: '評価項目と基準', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40', timeSaved: '2時間' },

  // カスタマーサポート
  { id: 'support-response', name: 'お問い合わせ回答', icon: <MessageSquare className="w-5 h-5" />, category: 'サポート', desc: 'CS対応テンプレート', gradient: 'from-lime-400 via-green-500 to-emerald-500', glow: 'shadow-lime-500/40', timeSaved: '15分' },
  { id: 'complaint-response', name: 'クレーム対応文', icon: <MessageSquare className="w-5 h-5" />, category: 'サポート', desc: '謝罪・対応文作成', gradient: 'from-lime-400 via-green-500 to-emerald-500', glow: 'shadow-lime-500/40', timeSaved: '30分' },

  // 法務・契約
  { id: 'terms-of-service', name: '利用規約', icon: <Scale className="w-5 h-5" />, category: '法務', desc: 'Webサービス利用規約', gradient: 'from-slate-400 via-gray-500 to-zinc-500', glow: 'shadow-slate-500/40', timeSaved: '4時間' },
  { id: 'privacy-policy', name: 'プライバシーポリシー', icon: <Scale className="w-5 h-5" />, category: '法務', desc: '個人情報保護方針', gradient: 'from-slate-400 via-gray-500 to-zinc-500', glow: 'shadow-slate-500/40', timeSaved: '3時間' },

  // 翻訳
  { id: 'translate-en', name: '英語翻訳', icon: <Languages className="w-5 h-5" />, category: '翻訳', desc: '日本語→英語', gradient: 'from-blue-400 via-indigo-500 to-purple-500', glow: 'shadow-blue-500/40', timeSaved: '30分' },
  { id: 'translate-ja', name: '日本語翻訳', icon: <Languages className="w-5 h-5" />, category: '翻訳', desc: '英語→日本語', gradient: 'from-blue-400 via-indigo-500 to-purple-500', glow: 'shadow-blue-500/40', timeSaved: '30分' },

  // 文章改善
  { id: 'rewrite-text', name: '文章リライト', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '文章をより良く', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '20分' },
  { id: 'proofread', name: '文章校正', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '誤字脱字・文法チェック', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '15分' },
  { id: 'tone-change', name: 'トーン変更', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: 'フォーマル/カジュアル', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '10分' },
  { id: 'expand-text', name: '文章を膨らませる', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '詳しく展開', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '15分' },
  { id: 'shorten-text', name: '文章を短くする', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '簡潔にまとめる', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40', timeSaved: '10分' },
]

const CATEGORIES = [
  { id: 'すべて', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'LP・Web', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'バナー・広告', icon: <Target className="w-3.5 h-3.5" /> },
  { id: '分析', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'SNS', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'ビジネス文書', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'コンテンツ', icon: <PenTool className="w-3.5 h-3.5" /> },
  { id: '営業', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'クリエイティブ', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: '企画', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { id: '教育・研修', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: '人事', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'サポート', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: '法務', icon: <Scale className="w-3.5 h-3.5" /> },
  { id: '翻訳', icon: <Languages className="w-3.5 h-3.5" /> },
  { id: '文章改善', icon: <Edit3 className="w-3.5 h-3.5" /> },
]

// 人気エージェント
const POPULAR_AGENTS = ALL_AGENTS.filter(a => a.popular)

export default function KantanTextListPage() {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('すべて')
  const [showOnlyPopular, setShowOnlyPopular] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'

  const filteredAgents = ALL_AGENTS.filter(agent => {
    const matchesSearch = agent.name.includes(searchQuery) || agent.desc.includes(searchQuery)
    const matchesCategory = selectedCategory === 'すべて' || agent.category === selectedCategory
    const matchesPopular = !showOnlyPopular || agent.popular
    return matchesSearch && matchesCategory && matchesPopular
  })

  // 総削減時間を計算（数字部分のみ抽出）
  const totalTimeSavedNum = ALL_AGENTS.reduce((acc, agent) => {
    const match = agent.timeSaved.match(/(\d+(?:\.\d+)?)/)
    if (match) {
      const num = parseFloat(match[1])
      if (agent.timeSaved.includes('日')) return acc + num * 8
      if (agent.timeSaved.includes('時間')) return acc + num
      if (agent.timeSaved.includes('分')) return acc + num / 60
    }
    return acc
  }, 0)

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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm"
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                      item.active
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
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
      <main className="flex-1 lg:ml-52">
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
            
            <h1 className="text-lg lg:text-xl font-bold text-gray-800">AIエージェント</h1>
            
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

        {/* コンテンツ */}
        <div className="p-4 lg:p-8">
        {/* 統計カード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Cpu className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-black text-gray-800">{ALL_AGENTS.length}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">AIエージェント</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Timer className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-black text-gray-800">{Math.round(totalTimeSavedNum)}h+</p>
                <p className="text-[10px] lg:text-xs text-gray-400">総削減時間</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Flame className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-black text-gray-800">{POPULAR_AGENTS.length}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">人気エージェント</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Layers className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-black text-gray-800">{CATEGORIES.length - 1}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">カテゴリ</p>
              </div>
            </div>
          </div>
        </div>

        {/* 人気エージェント */}
        <div className="mb-6 lg:mb-10">
          <div className="flex items-center gap-2 mb-3 lg:mb-4">
            <Flame className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
            <h2 className="text-sm lg:text-base font-bold text-gray-800">人気エージェント</h2>
            <span className="text-[10px] lg:text-xs text-gray-400 hidden sm:inline">- 最もよく使われています</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {POPULAR_AGENTS.slice(0, 4).map((agent) => (
              <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`} className="group">
                <div className="relative h-full">
                  <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500`} />
                  <div className="relative h-full p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className={`absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br ${agent.gradient} opacity-10 blur-2xl`} />
                    <div className="relative flex items-start gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${agent.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {agent.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-500 font-bold">人気</span>
                        </div>
                        <h3 className="font-bold text-gray-800 truncate text-sm">{agent.name}</h3>
                        <p className="text-xs text-gray-400 truncate mb-2">{agent.desc}</p>
                        <div className="flex items-center gap-1.5">
                          <Timer className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs text-emerald-500 font-bold">-{agent.timeSaved}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 検索 */}
        <div className="mb-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="AIエージェントを検索..."
                className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm transition-all duration-300"
            />
            </div>
          </div>
        </div>

        {/* カテゴリフィルタ */}
        <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-6 lg:mb-8">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`group/cat relative px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              {category.icon}
              {category.id}
            </button>
          ))}
        </div>

        {/* 結果数とソート */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {filteredAgents.length}件のエージェント
          </p>
          <button
            onClick={() => setShowOnlyPopular(!showOnlyPopular)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showOnlyPopular
                ? 'bg-amber-100 border border-amber-300 text-amber-600'
                : 'bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Star className="w-3 h-3" />
            人気のみ
          </button>
        </div>

        {/* エージェント一覧 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-8 lg:mb-12">
          {filteredAgents.map((agent) => (
            <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`} className="group">
              <div className="relative h-full">
                {/* グロー */}
                <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500`} />
                
                {/* カード */}
                <div className="relative h-full p-4 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:bg-white transition-all duration-300 overflow-hidden group-hover:translate-y-[-2px]">
                  {/* 装飾 */}
                  <div className={`absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br ${agent.gradient} opacity-10 blur-2xl group-hover:opacity-30 transition-opacity`} />
                  
                  <div className="relative flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${agent.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {agent.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 truncate text-sm">{agent.name}</h3>
                        {agent.popular && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{agent.desc}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
                        <Timer className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] text-emerald-600 font-bold">-{agent.timeSaved}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-400 text-lg">該当するAIエージェントが見つかりません</p>
          </div>
        )}

        {/* 他サービス */}
        <div className="space-y-4">
          <h3 className="text-center text-gray-400 text-sm font-bold uppercase tracking-wider mb-6">専門AIツール</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/banner" className="block group">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-5 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-xl">🎨</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">ドヤバナーAI</h4>
                      <p className="text-xs text-gray-400">A/B/Cの3案を同時に作成</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/seo" className="block group">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-100 to-gray-100 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-5 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-xl">🧠</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">ドヤライティングAI</h4>
                      <p className="text-xs text-gray-400">5万字超の長文記事も安定生成</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}
