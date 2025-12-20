'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search, Sparkles, FileText, Lightbulb, BarChart3, Target, MessageSquare, TrendingUp, Users, PenTool, Mail, Megaphone, Layers, Briefcase, Palette, Globe, Zap, BookOpen, Settings, Scale, Languages, Edit3, Cpu, ChevronRight, Rocket } from 'lucide-react'
import { useState } from 'react'

// マーケティング中心の全AIエージェント一覧
const ALL_AGENTS = [
  // LP・Web制作
  { id: 'lp-full-text', name: 'LP構成案・テキスト作成', icon: <FileText className="w-5 h-5" />, category: 'LP・Web', desc: 'ファーストビューからCTAまで', gradient: 'from-cyan-400 via-cyan-500 to-teal-500', glow: 'shadow-cyan-500/40' },
  { id: 'lp-headline', name: 'LPキャッチコピー', icon: <Sparkles className="w-5 h-5" />, category: 'LP・Web', desc: 'ファーストビュー用コピー10案', gradient: 'from-cyan-400 via-cyan-500 to-teal-500', glow: 'shadow-cyan-500/40' },
  
  // バナー・広告コピー
  { id: 'ab-test-copy', name: 'A/Bテスト用コピー', icon: <Layers className="w-5 h-5" />, category: 'バナー・広告', desc: '5つのアプローチで比較', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },
  { id: 'google-ad-title', name: 'Google広告タイトル', icon: <Target className="w-5 h-5" />, category: 'バナー・広告', desc: '高CTRタイトル10パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },
  { id: 'google-ad-description', name: 'Google広告説明文', icon: <Target className="w-5 h-5" />, category: 'バナー・広告', desc: '90文字以内の説明文5案', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },
  { id: 'facebook-ad-copy', name: 'Facebook広告文', icon: <Megaphone className="w-5 h-5" />, category: 'バナー・広告', desc: 'FB広告用コピー3パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },
  { id: 'instagram-ad', name: 'Instagram広告文', icon: <Palette className="w-5 h-5" />, category: 'バナー・広告', desc: 'キャプション+ハッシュタグ', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },
  { id: 'twitter-ad', name: 'Twitter/X広告文', icon: <MessageSquare className="w-5 h-5" />, category: 'バナー・広告', desc: '140文字ツイート5パターン', gradient: 'from-amber-400 via-orange-500 to-red-500', glow: 'shadow-orange-500/40' },

  // 分析・リサーチ
  { id: 'persona-creation', name: 'ペルソナ作成', icon: <Users className="w-5 h-5" />, category: '分析', desc: '詳細な顧客ペルソナを生成', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40' },
  { id: 'market-analysis', name: '市場分析レポート', icon: <TrendingUp className="w-5 h-5" />, category: '分析', desc: '市場規模・トレンド分析', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40' },
  { id: 'competitor-analysis', name: '競合分析レポート', icon: <BarChart3 className="w-5 h-5" />, category: '分析', desc: '競合の強み・弱みを整理', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40' },
  { id: 'swot-analysis', name: 'SWOT分析', icon: <BarChart3 className="w-5 h-5" />, category: '分析', desc: '強み・弱み・機会・脅威', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40' },
  { id: 'user-journey', name: 'カスタマージャーニー', icon: <Users className="w-5 h-5" />, category: '分析', desc: '顧客体験を可視化', gradient: 'from-violet-400 via-purple-500 to-fuchsia-500', glow: 'shadow-purple-500/40' },

  // SNS運用
  { id: 'instagram-caption', name: 'Instagram投稿文', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: 'エンゲージUPキャプション', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'twitter-thread', name: 'Twitter/Xスレッド', icon: <MessageSquare className="w-5 h-5" />, category: 'SNS', desc: 'バズりやすいスレッド', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'tiktok-script', name: 'TikTok台本', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: 'バズる動画台本', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'youtube-script', name: 'YouTube台本', icon: <Palette className="w-5 h-5" />, category: 'SNS', desc: '視聴維持率を意識した台本', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'linkedin-post', name: 'LinkedIn投稿文', icon: <Briefcase className="w-5 h-5" />, category: 'SNS', desc: 'ビジネス向け投稿', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'sns-content-calendar', name: 'SNSコンテンツカレンダー', icon: <Layers className="w-5 h-5" />, category: 'SNS', desc: '1ヶ月分の投稿計画', gradient: 'from-rose-400 via-pink-500 to-red-500', glow: 'shadow-pink-500/40' },

  // ビジネス文書
  { id: 'business-email', name: 'ビジネスメール', icon: <Mail className="w-5 h-5" />, category: 'ビジネス文書', desc: '丁寧なメールを作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'email-reply', name: 'メール返信', icon: <Mail className="w-5 h-5" />, category: 'ビジネス文書', desc: '受信メールへの返信', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'meeting-agenda', name: '会議アジェンダ', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '効率的なアジェンダ', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'meeting-minutes', name: '議事録', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '会議メモから議事録生成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'proposal-document', name: '提案書', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '企画提案書を作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'report-weekly', name: '週次報告書', icon: <FileText className="w-5 h-5" />, category: 'ビジネス文書', desc: '業務報告書を作成', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },
  { id: 'presentation-outline', name: 'プレゼン構成', icon: <Layers className="w-5 h-5" />, category: 'ビジネス文書', desc: 'スライド構成案', gradient: 'from-blue-400 via-indigo-500 to-violet-500', glow: 'shadow-indigo-500/40' },

  // 記事・コンテンツ
  { id: 'blog-article', name: 'ブログ記事', icon: <PenTool className="w-5 h-5" />, category: 'コンテンツ', desc: 'SEOを意識した記事', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },
  { id: 'article-outline', name: '記事構成案', icon: <FileText className="w-5 h-5" />, category: 'コンテンツ', desc: '見出し構成を自動生成', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },
  { id: 'seo-title-meta', name: 'SEOタイトル・メタ', icon: <Search className="w-5 h-5" />, category: 'コンテンツ', desc: 'CTR向上のタイトル案', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },
  { id: 'article-summary', name: '記事・論文要約', icon: <FileText className="w-5 h-5" />, category: 'コンテンツ', desc: '長い文章を要約', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },
  { id: 'press-release', name: 'プレスリリース', icon: <Globe className="w-5 h-5" />, category: 'コンテンツ', desc: 'PR TIMES形式で生成', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },
  { id: 'newsletter', name: 'メルマガ', icon: <Mail className="w-5 h-5" />, category: 'コンテンツ', desc: '開封率UPのメール', gradient: 'from-teal-400 via-cyan-500 to-blue-500', glow: 'shadow-cyan-500/40' },

  // 営業・セールス
  { id: 'sales-pitch', name: 'セールスピッチ', icon: <Zap className="w-5 h-5" />, category: '営業', desc: '商談で使えるピッチ', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40' },
  { id: 'product-description', name: '商品説明文', icon: <FileText className="w-5 h-5" />, category: '営業', desc: '魅力的な商品説明', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40' },
  { id: 'sales-email', name: '営業メール', icon: <Mail className="w-5 h-5" />, category: '営業', desc: '新規開拓・フォローアップ', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40' },
  { id: 'objection-handling', name: '反論対応スクリプト', icon: <MessageSquare className="w-5 h-5" />, category: '営業', desc: '営業での反論対応', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40' },
  { id: 'case-study', name: '導入事例', icon: <TrendingUp className="w-5 h-5" />, category: '営業', desc: '顧客成功事例を構成', gradient: 'from-emerald-400 via-green-500 to-teal-500', glow: 'shadow-emerald-500/40' },

  // クリエイティブ
  { id: 'catchcopy', name: 'キャッチコピー', icon: <Sparkles className="w-5 h-5" />, category: 'クリエイティブ', desc: 'インパクト重視の10案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40' },
  { id: 'naming', name: 'ネーミング', icon: <Lightbulb className="w-5 h-5" />, category: 'クリエイティブ', desc: '商品・サービス名20案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40' },
  { id: 'slogan', name: 'スローガン・タグライン', icon: <Megaphone className="w-5 h-5" />, category: 'クリエイティブ', desc: 'ブランドタグライン10案', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40' },
  { id: 'brand-story', name: 'ブランドストーリー', icon: <PenTool className="w-5 h-5" />, category: 'クリエイティブ', desc: '感情に訴えるストーリー', gradient: 'from-fuchsia-400 via-purple-500 to-violet-500', glow: 'shadow-fuchsia-500/40' },

  // 企画・アイデア
  { id: 'brainstorm', name: 'ブレストアイデア出し', icon: <Lightbulb className="w-5 h-5" />, category: '企画', desc: 'アイデア30個を生成', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40' },
  { id: 'business-plan', name: '新規事業企画書', icon: <TrendingUp className="w-5 h-5" />, category: '企画', desc: '事業計画の骨子', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40' },
  { id: 'event-plan', name: 'イベント企画書', icon: <Layers className="w-5 h-5" />, category: '企画', desc: 'イベント企画の構成', gradient: 'from-yellow-400 via-amber-500 to-orange-500', glow: 'shadow-amber-500/40' },

  // 教育・研修
  { id: 'business-manual', name: '業務マニュアル', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '分かりやすいマニュアル', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40' },
  { id: 'training-curriculum', name: '研修カリキュラム', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '研修プログラム設計', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40' },
  { id: 'faq-creation', name: 'FAQ作成', icon: <MessageSquare className="w-5 h-5" />, category: '教育・研修', desc: 'よくある質問と回答', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40' },
  { id: 'quiz-creation', name: 'テスト問題作成', icon: <BookOpen className="w-5 h-5" />, category: '教育・研修', desc: '理解度確認テスト', gradient: 'from-indigo-400 via-blue-500 to-cyan-500', glow: 'shadow-indigo-500/40' },

  // 人事・採用
  { id: 'job-posting', name: '求人票', icon: <Briefcase className="w-5 h-5" />, category: '人事', desc: '魅力的な求人票', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40' },
  { id: 'interview-questions', name: '面接質問', icon: <Users className="w-5 h-5" />, category: '人事', desc: '採用面接用の質問', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40' },
  { id: 'evaluation-sheet', name: '人事評価シート', icon: <FileText className="w-5 h-5" />, category: '人事', desc: '評価項目と基準', gradient: 'from-sky-400 via-blue-500 to-indigo-500', glow: 'shadow-sky-500/40' },

  // カスタマーサポート
  { id: 'support-response', name: 'お問い合わせ回答', icon: <MessageSquare className="w-5 h-5" />, category: 'サポート', desc: 'CS対応テンプレート', gradient: 'from-lime-400 via-green-500 to-emerald-500', glow: 'shadow-lime-500/40' },
  { id: 'complaint-response', name: 'クレーム対応文', icon: <MessageSquare className="w-5 h-5" />, category: 'サポート', desc: '謝罪・対応文作成', gradient: 'from-lime-400 via-green-500 to-emerald-500', glow: 'shadow-lime-500/40' },

  // 法務・契約
  { id: 'terms-of-service', name: '利用規約', icon: <Scale className="w-5 h-5" />, category: '法務', desc: 'Webサービス利用規約', gradient: 'from-slate-400 via-gray-500 to-zinc-500', glow: 'shadow-slate-500/40' },
  { id: 'privacy-policy', name: 'プライバシーポリシー', icon: <Scale className="w-5 h-5" />, category: '法務', desc: '個人情報保護方針', gradient: 'from-slate-400 via-gray-500 to-zinc-500', glow: 'shadow-slate-500/40' },

  // 翻訳
  { id: 'translate-en', name: '英語翻訳', icon: <Languages className="w-5 h-5" />, category: '翻訳', desc: '日本語→英語', gradient: 'from-blue-400 via-indigo-500 to-purple-500', glow: 'shadow-blue-500/40' },
  { id: 'translate-ja', name: '日本語翻訳', icon: <Languages className="w-5 h-5" />, category: '翻訳', desc: '英語→日本語', gradient: 'from-blue-400 via-indigo-500 to-purple-500', glow: 'shadow-blue-500/40' },

  // 文章改善
  { id: 'rewrite-text', name: '文章リライト', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '文章をより良く', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'proofread', name: '文章校正', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '誤字脱字・文法チェック', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'tone-change', name: 'トーン変更', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: 'フォーマル/カジュアル', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'expand-text', name: '文章を膨らませる', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '詳しく展開', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40' },
  { id: 'shorten-text', name: '文章を短くする', icon: <Edit3 className="w-5 h-5" />, category: '文章改善', desc: '簡潔にまとめる', gradient: 'from-pink-400 via-rose-500 to-red-500', glow: 'shadow-pink-500/40' },
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

export default function KantanTextListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('すべて')

  const filteredAgents = ALL_AGENTS.filter(agent => {
    const matchesSearch = agent.name.includes(searchQuery) || agent.desc.includes(searchQuery)
    const matchesCategory = selectedCategory === 'すべて' || agent.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* アニメーション背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/30 via-transparent to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/kantan/dashboard" className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-all duration-300">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-medium">ダッシュボード</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl blur opacity-50" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold">全AIエージェント</span>
              <span className="text-white/40 text-sm ml-2">({ALL_AGENTS.length}種類)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full text-xs font-bold">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <Cpu className="w-3 h-3 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Gemini 3.0</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* 検索 */}
        <div className="mb-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="AIエージェントを検索..."
                className="w-full pl-14 pr-6 py-4 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl text-white placeholder-white/30 focus:border-cyan-500/30 focus:bg-white/[0.05] outline-none transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* カテゴリフィルタ */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`group/cat relative px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-white'
                  : 'bg-white/[0.02] border border-white/5 text-white/40 hover:text-white/70 hover:border-white/10'
              }`}
            >
              {category.icon}
              {category.id}
            </button>
          ))}
        </div>

        {/* エージェント一覧 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {filteredAgents.map((agent) => (
            <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`} className="group">
              <div className="relative h-full">
                {/* グロー */}
                <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500`} />
                
                {/* カード */}
                <div className="relative h-full p-4 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl hover:border-white/10 transition-all duration-300 overflow-hidden">
                  {/* 装飾 */}
                  <div className={`absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br ${agent.gradient} opacity-10 blur-2xl group-hover:opacity-30 transition-opacity`} />
                  
                  <div className="relative flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${agent.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg ${agent.glow} group-hover:scale-110 transition-transform duration-300`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate text-sm">{agent.name}</h3>
                      <p className="text-xs text-white/40 truncate">{agent.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/30 text-lg">該当するAIエージェントが見つかりません</p>
          </div>
        )}

        {/* 他サービス */}
        <div className="space-y-4">
          <h3 className="text-center text-white/30 text-sm font-bold uppercase tracking-wider mb-6">専門AIツール</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/banner" className="block group">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-purple-500/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                      <span className="text-xl">🎨</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white">ドヤバナーAI</h4>
                      <p className="text-xs text-white/40">A/B/Cの3案を同時に作成</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/seo" className="block group">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-500/20 to-gray-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-slate-500/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/20 group-hover:scale-110 transition-transform">
                      <span className="text-xl">🧠</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white">ドヤSEO</h4>
                      <p className="text-xs text-white/40">5万字超の長文記事も安定生成</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
