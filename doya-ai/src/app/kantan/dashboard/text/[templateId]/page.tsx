'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Sparkles, Loader2, Copy, Check, 
  RefreshCw, Wand2, LogIn, Send, ChevronRight, Rocket, Cpu, User, Bot, MessageSquare,
  Timer, FileText, Download, Zap, CheckCircle2, ChevronDown, History, Star,
  Home, DollarSign, Settings, HelpCircle, BarChart3, Clock, UserCircle, TrendingUp,
  Menu, X
} from 'lucide-react'

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
import toast, { Toaster } from 'react-hot-toast'
import { SAMPLE_TEMPLATES } from '@/lib/templates'

// ゲスト使用状況管理
const GUEST_DAILY_LIMIT = 3
const GUEST_STORAGE_KEY = 'kantan_guest_usage'

function getGuestUsage(): { count: number; date: string } {
  if (typeof window === 'undefined') return { count: 0, date: '' }
  const stored = localStorage.getItem(GUEST_STORAGE_KEY)
  if (!stored) return { count: 0, date: '' }
  try {
    return JSON.parse(stored)
  } catch {
    return { count: 0, date: '' }
  }
}

function setGuestUsage(count: number) {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ count, date: today }))
}

// チャットメッセージ型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// サンプル入力データ（全68テンプレート対応）
const SAMPLE_INPUTS: Record<string, Record<string, string>> = {
  // ==================== マーケティング ====================
  'google-ad-title': {
    productName: 'オンライン英会話アプリ',
    targetAudience: '英語を話せるようになりたい社会人',
    features: '1日10分から、ネイティブ講師とマンツーマン',
    objective: '無料体験申込',
  },
  'google-ad-description': {
    productName: 'AIマーケティングツール',
    target: 'マーケター、広告運用担当者',
    appeal: 'LP構成案を4時間→10分で作成。広告コピー40案を1分で生成。Gemini 2.0搭載で高品質。',
    cta: '無料で試す',
  },
  'facebook-ad-copy': {
    productName: 'オンラインヨガスタジオ',
    targetAudience: '30-40代の運動不足を感じている女性',
    features: '自宅で本格レッスン、月額980円から、100種類以上のプログラム',
    appealPoint: '忙しい毎日でも、スキマ時間に自宅でリフレッシュ',
  },
  'instagram-ad': {
    product: 'オーガニックスキンケアブランド',
    target: '20-30代の美容に関心のある女性',
    appeal: '天然成分100%、敏感肌にも優しい、サステナブルパッケージ',
    tone: 'エレガント',
  },
  'twitter-ad': {
    product: 'プログラミング学習サービス',
    target: 'IT転職を考えている20-30代',
    appeal: '未経験から3ヶ月でエンジニア転職。メンター付きで挫折しない。',
  },
  'lp-full-text': {
    productName: 'AIマーケティングツール「カンタンマーケAI」',
    description: 'LP構成案4時間→10分、バナーコピー40案を1分で生成できるAIツール',
    targetAudience: 'マーケティング業務を効率化したい中小企業のマーケター',
    price: '月額4,980円〜',
    differentiator: 'Gemini 2.0搭載、チャット形式でブラッシュアップ可能、68種類以上のAIエージェント',
  },
  'lp-headline': {
    product: 'AIマーケティングツール',
    target: 'マーケター、事業責任者',
    benefit: 'LP構成案4時間→10分、広告コピー40案を1分で生成',
    difference: 'チャット形式で何度でもブラッシュアップ可能',
  },
  'ab-test-copy': {
    target: 'LP',
    objective: 'CVR向上',
    currentCopy: '今すぐ始めよう！AIで広告運用を効率化',
  },

  // ==================== ペルソナ・分析 ====================
  'persona-creation': {
    productName: 'クラウド会計ソフト',
    description: '中小企業向けの経理業務を自動化するSaaS',
    targetAudience: '従業員30名以下の中小企業経営者',
  },
  'market-analysis': {
    market: 'AI SaaS市場',
    region: '日本',
    purpose: '新規サービスの市場参入可能性を検討するため',
  },
  'competitor-analysis': {
    ourService: 'AIマーケティングツール「カンタンマーケAI」',
    competitors: 'ChatGPT, Notion AI, Jasper AI',
    industry: 'AI SaaS / マーケティングツール',
  },
  'swot-analysis': {
    business: 'オンライン英会話スクール',
    industry: 'オンライン教育',
    situation: '創業3年目。月間利用者5000人。競合の大手が価格競争を仕掛けてきている状況。',
  },
  'user-journey': {
    service: 'クラウド会計ソフト',
    target: '個人事業主（フリーランスのデザイナー）、35歳、年商500万円',
    goal: '確定申告の時間を半減させる',
  },

  // ==================== SNS運用 ====================
  'instagram-caption': {
    content: '新商品のオーガニックスキンケアセットを紹介。肌に優しい天然成分100%使用。',
    tone: 'ポップ',
    target: '20-30代の美容に関心のある女性',
  },
  'twitter-thread': {
    theme: 'マーケターが知っておくべきAI活用術',
    target: 'マーケティング担当者',
    purpose: 'サービス認知拡大とフォロワー獲得',
  },
  'tiktok-script': {
    theme: '1分でわかる確定申告の基礎知識',
    duration: '60秒',
    target: '20代のフリーランス・副業者',
  },
  'youtube-script': {
    title: 'ChatGPTを使った業務効率化術5選',
    duration: '10分',
    genre: 'ビジネスハウツー',
    target: 'リモートワーカー、ビジネスパーソン',
  },
  'linkedin-post': {
    theme: 'AIツール導入で生産性が3倍になった話',
    purpose: 'ブランディング',
    tone: 'カジュアル',
  },
  'sns-content-calendar': {
    platform: 'Instagram',
    industry: '美容・コスメ',
    purpose: 'ブランド認知向上と新商品プロモーション',
  },

  // ==================== ビジネス文書 ====================
  'business-email': {
    emailType: '依頼・お願い',
    recipient: '取引先・クライアント',
    subject: '打ち合わせ日程の調整について',
    content: '来週中に1時間ほどお時間いただき、新サービスのご説明をさせていただきたく存じます。ご都合の良い日時をいくつかご教示いただけますと幸いです。',
    tone: '丁寧（無難に）',
  },
  'email-reply': {
    originalEmail: '先日のお打ち合わせありがとうございました。ご提案いただいた内容について、社内で検討した結果、いくつか確認事項がございます。来週中にお時間いただけますでしょうか。',
    direction: '了承',
    additional: '来週火曜日または水曜日の午後が空いています',
  },
  'meeting-agenda': {
    meetingName: '新規プロジェクトキックオフミーティング',
    purpose: 'プロジェクト概要の共有と役割分担の決定',
    participants: 'マーケティング部3名、開発部2名、デザイン部1名',
    duration: '1時間',
    topics: 'プロジェクト概要説明、スケジュール確認、役割分担、次回までのタスク確認',
  },
  'meeting-minutes': {
    meetingName: '週次定例ミーティング',
    datetime: '2024年12月20日 10:00-11:00',
    participants: '田中、鈴木、佐藤、山田',
    notes: '・先週のKPI達成状況：目標の105%達成\n・課題：リード獲得のCPAが上昇傾向\n・対策：クリエイティブのABテスト実施\n・来週の重点施策：年末キャンペーンの最終調整',
  },
  'proposal-document': {
    title: 'AIチャットボット導入による顧客対応効率化提案',
    background: '現在、カスタマーサポートへの問い合わせが月間500件以上あり、対応に時間がかかっている。同じ質問が繰り返されることも多い。',
    proposal: 'AIチャットボットを導入し、よくある質問への自動応答を実現。24時間対応可能に。',
    effect: '対応時間50%削減、顧客満足度向上、人件費年間300万円削減',
    schedule: '1月：要件定義、2月：開発、3月：テスト運用、4月：本番運用開始',
  },
  'report-weekly': {
    period: '12/16〜12/20',
    achievements: '・新規LP公開（PV 5000達成）\n・広告ABテスト完了（CTR 1.5%→2.1%改善）\n・顧客インタビュー3件実施',
    issues: 'メール配信システムの遅延が発生（12/18に解消済み）',
    nextWeek: '年末キャンペーン開始、年間レポート作成、来年度計画MTG',
  },
  'presentation-outline': {
    theme: '2025年マーケティング戦略',
    purpose: '来年度のマーケティング施策の承認を得る',
    audience: '経営陣（CEO、CFO、CMO）',
    duration: '15分',
  },

  // ==================== 記事・コンテンツ ====================
  'blog-article': {
    theme: 'リモートワークの生産性を上げる方法',
    target: '30代のビジネスパーソン',
    purpose: 'ハウツー',
    keywords: 'リモートワーク,在宅勤務,生産性,集中力',
    wordCount: '2000文字',
  },
  'article-outline': {
    theme: '2025年注目のマーケティングトレンド',
    target: 'マーケティング担当者',
    type: 'まとめ記事',
  },
  'seo-title-meta': {
    theme: 'ChatGPTの使い方',
    keyword: 'ChatGPT 使い方',
    summary: 'ChatGPTの基本的な使い方から、ビジネスでの活用方法、プロンプトのコツまで徹底解説する記事',
  },
  'article-summary': {
    originalText: '昨今、AI技術の急速な発展により、マーケティング業界にも大きな変革が起きています。特にLLM（大規模言語モデル）を活用したツールは、コピーライティング、データ分析、顧客対応など様々な領域で活用されています。McKinseyの調査によると、マーケティング業務の約40%はAIによる自動化が可能とされており、多くの企業がAI導入を進めています。一方で、AIはあくまでもツールであり、人間のクリエイティビティや戦略的思考を代替するものではないという声もあります。重要なのは、AIと人間がそれぞれの強みを活かして協働することです。',
    format: '箇条書き',
    length: '100文字程度',
  },
  'press-release': {
    title: 'AIマーケティングツール「カンタンマーケAI」正式リリース',
    content: 'Gemini 2.0を搭載し、LP構成案やSNS投稿文など68種類以上のマーケティングコンテンツをAIが自動生成。チャット形式でブラッシュアップも可能。',
    company: '株式会社ドヤテック',
    date: '2024年12月21日',
  },
  'newsletter': {
    theme: '年末年始のお知らせと2024年の振り返り',
    target: '既存顧客（BtoB SaaS利用者）',
    purpose: '情報提供',
    info: '・年末年始の営業日程\n・2024年のアップデートまとめ\n・2025年のロードマップ予告\n・お客様感謝キャンペーン',
  },

  // ==================== 営業・セールス ====================
  'sales-pitch': {
    product: 'クラウド型顧客管理システム',
    target: '営業チームを持つ中小企業の経営者',
    problem: '顧客情報がExcelに散在。営業担当者ごとに管理方法がバラバラで引き継ぎも困難。',
    solution: 'クラウドで一元管理。営業履歴が自動で記録され、誰でもすぐに状況把握可能。',
  },
  'product-description': {
    productName: 'エルゴノミクスオフィスチェア Pro',
    category: 'オフィス家具',
    features: '・人間工学に基づいた設計\n・12段階のリクライニング\n・通気性抜群のメッシュ素材\n・5年間保証',
    target: 'リモートワーカー、長時間デスクワークをする人',
    price: '39,800円',
  },
  'sales-email': {
    purpose: '新規開拓',
    product: 'AIマーケティングツール「カンタンマーケAI」',
    recipient: 'EC事業者、マーケティング担当者がいる中小企業',
    appeal: 'LP構成案を4時間→10分で作成。人件費換算で月間50時間以上削減の実績あり。',
  },
  'objection-handling': {
    product: 'クラウド型業務管理システム',
    objections: '価格が高い、導入が大変そう、今のやり方で困っていない',
  },
  'case-study': {
    customer: '製造業、従業員50名',
    service: 'AIマーケティングツール',
    problem: 'マーケティング専任者がおらず、広告運用やLP制作に時間がかかっていた。外注費も年間300万円かかっていた。',
    result: '導入後3ヶ月で外注費50%削減。社内でのコンテンツ制作が可能に。問い合わせ数が1.5倍に増加。',
  },

  // ==================== クリエイティブ ====================
  'catchcopy': {
    product: 'オンライン英会話サービス',
    target: '英語を学び直したい30代社会人',
    appeal: '1日15分から始められる、ネイティブ講師とのマンツーマンレッスン。通勤時間でも受講可能。',
    tone: 'インパクト重視',
  },
  'naming': {
    target: 'AIマーケティング支援サービス',
    concept: '誰でも簡単にプロ並みのマーケティングができる。時間を大幅に短縮できる。',
    image: '先進的、信頼感、スピード感',
    ng: '英語のみは避けたい',
  },
  'slogan': {
    brand: 'カンタンマーケAI',
    business: 'AIを活用したマーケティング支援ツール',
    mission: 'すべての人にプロレベルのマーケティングを',
    target: '中小企業のマーケター、個人事業主',
  },
  'brand-story': {
    brand: 'カンタンマーケAI',
    background: 'マーケティング担当者の「時間がない」「専門知識がない」という悩みを何度も聞いてきた創業者が、AIの力で解決したいと思い立った。',
    mission: 'すべての企業にプロ品質のマーケティングを届ける',
    values: '簡単さ、スピード、品質、誰もが使える',
  },

  // ==================== 教育・研修 ====================
  'business-manual': {
    taskName: '新入社員向けビジネスメール作成',
    description: '社内外へのビジネスメールの書き方、マナー、注意点を説明するマニュアル',
    audience: '新入社員（ビジネスメール経験なし）',
    prerequisites: '基本的なPC操作、メールソフトの使い方',
  },
  'training-curriculum': {
    theme: 'デジタルマーケティング基礎研修',
    audience: '営業部門からマーケティング部門への異動者',
    duration: '1日',
    goal: 'デジタルマーケティングの基礎用語と施策を理解し、日常業務に活かせるようになる',
  },
  'faq-creation': {
    service: 'AIマーケティングツール「カンタンマーケAI」',
    target: '導入検討中の企業担当者、既存ユーザー',
    categories: '料金、機能、サポート、セキュリティ',
  },
  'quiz-creation': {
    theme: 'デジタルマーケティング基礎',
    difficulty: '初級',
    count: '10問',
    format: '選択式',
  },

  // ==================== 人事・採用 ====================
  'job-posting': {
    position: 'マーケティングマネージャー',
    type: '正社員',
    appeal: '・リモートワーク可能\n・急成長中のAI SaaS企業\n・裁量が大きい\n・ストックオプション制度あり',
    requirements: 'BtoBマーケティング経験3年以上、データ分析スキル、チームマネジメント経験',
  },
  'interview-questions': {
    position: 'マーケティングマネージャー',
    evaluation: '戦略的思考、リーダーシップ、データ分析力、成果へのコミットメント',
    stage: '二次面接',
  },
  'evaluation-sheet': {
    position: 'マーケティング担当',
    period: '半期',
    items: '業績（KPI達成率）、スキル、コミュニケーション、主体性',
  },

  // ==================== 法務・契約 ====================
  'terms-of-service': {
    serviceName: 'カンタンマーケAI',
    description: 'AIを活用してマーケティングコンテンツを自動生成するWebサービス',
    users: '両方',
  },
  'privacy-policy': {
    serviceName: 'カンタンマーケAI',
    dataCollected: '氏名、メールアドレス、利用履歴、決済情報（クレジットカード番号は保持しない）',
    purpose: 'サービス提供、カスタマーサポート、サービス改善、マーケティング',
  },

  // ==================== カスタマーサポート ====================
  'support-response': {
    inquiry: 'プランをアップグレードしたいのですが、どうすればいいですか？また、途中でダウングレードは可能ですか？',
    direction: '解決策の提示',
    tone: '丁寧',
  },
  'complaint-response': {
    complaint: '昨日からサービスにログインできません。仕事で使っているので非常に困っています。',
    cause: 'サーバーメンテナンスの影響で一時的にログインに問題が発生していた',
    solution: '現在は復旧済み。お詫びとして1週間分のPro機能を無料で提供',
  },

  // ==================== 企画・アイデア ====================
  'brainstorm': {
    theme: '既存顧客のリテンション率を上げる施策',
    constraints: '予算100万円以内、3ヶ月以内に実施可能',
    target: 'SaaS利用者（月額課金）',
  },
  'business-plan': {
    businessName: 'AIレシピ提案サービス「今日なに食べる？」',
    description: '冷蔵庫の中身を写真で撮るだけで、作れるレシピをAIが提案。栄養バランスも考慮。',
    market: '料理に時間をかけたくない共働き世帯、一人暮らし',
    revenue: '月額制サブスクリプション、食材宅配サービスとの連携による送客手数料',
  },
  'event-plan': {
    eventName: 'AI活用マーケティングセミナー',
    purpose: '見込み顧客獲得とブランド認知向上',
    target: '中小企業のマーケティング担当者、経営者',
    budget: '50万円',
    date: '2025年2月中旬',
  },

  // ==================== 翻訳・多言語 ====================
  'translate-en': {
    japanese: 'この度は弊社サービスをご利用いただき、誠にありがとうございます。ご不明な点がございましたら、お気軽にお問い合わせください。',
    tone: 'ビジネス',
  },
  'translate-ja': {
    english: 'We are pleased to announce the launch of our new AI-powered marketing tool. This solution helps businesses create compelling content 10x faster than traditional methods.',
    tone: 'ビジネス',
  },

  // ==================== 文章改善・校正 ====================
  'rewrite-text': {
    originalText: 'このサービスを使えばマーケティングが楽になります。いろいろな機能があって便利です。ぜひ使ってください。',
    direction: '説得力UP',
    tone: 'ビジネス',
  },
  'proofread': {
    text: '昨日のミーティングで話し合った件につきまして、ご報告させて頂きます。まず、新商品の発売日についてですか、3月1日で決定致しました。また、予算についても承認を頂きましたので、早速準備を進めて参ります。なお、詳細なスケジュールは来週までに作成し、改めてご連絡差しあげます。',
  },
  'tone-change': {
    text: 'マジで使いやすいから、ぜひ試してみて！めっちゃおすすめ！',
    tone: 'フォーマル',
  },
  'expand-text': {
    text: 'AIを使えばマーケティング業務が効率化できます。',
    targetLength: '3倍程度',
  },
  'shorten-text': {
    text: '私たちのサービスは、最新のAI技術を活用することにより、これまで手作業で行っていたマーケティング業務を大幅に効率化することができます。例えば、ランディングページの構成案作成には従来4時間程度かかっていましたが、私たちのサービスを使えばわずか10分程度で完成させることができます。',
    target: '半分程度',
  },
  'code-review': {
    language: 'JavaScript',
    code: 'function fetchData(url) {\n  fetch(url).then(res => res.json()).then(data => console.log(data));\n}',
    focus: '全般',
  },
}

// 修正提案のサンプル
const REFINEMENT_SUGGESTIONS = [
  'もっとカジュアルに',
  '具体的な数値を入れて',
  '箇条書きで整理して',
  'CTAを強めに',
  '文章を短くして',
  '別の切り口で',
]

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const templateId = params.templateId as string
  const chatEndRef = useRef<HTMLDivElement>(null)

  // テンプレート取得
  const template = SAMPLE_TEMPLATES.find(t => t.id === templateId)

  // フォーム状態
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [guestUsageCount, setGuestUsageCount] = useState(0)
  const [generationTime, setGenerationTime] = useState(0)
  const [showInputs, setShowInputs] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  // チャット状態
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const isGuest = !session
  
  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage()
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  // チャット末尾にスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const guestRemainingCount = GUEST_DAILY_LIMIT - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0
  
  // 入力が全て揃っているかチェック
  const isFormValid = template?.inputFields.every(field => {
    if (!field.required) return true
    return inputs[field.name]?.trim()
  }) ?? false

  const canGenerate = isFormValid && (session || canGuestGenerate)

  // テンプレートが見つからない
  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-500 mb-4">テンプレートが見つかりません</p>
          <Link href="/kantan/dashboard" className="text-blue-500 hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[templateId]
    if (sample) {
      setInputs(sample)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    } else {
      // 汎用的なサンプル
      const genericInputs: Record<string, string> = {}
      template.inputFields.forEach(field => {
        if (field.type === 'select' && field.options) {
          genericInputs[field.name] = field.options[0]
        } else if (field.placeholder) {
          genericInputs[field.name] = field.placeholder.replace('例：', '')
        } else {
          genericInputs[field.name] = `サンプル${field.label}`
        }
      })
      setInputs(genericInputs)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    }
  }

  // 生成
  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setOutput('')
    setChatMessages([])
    const startTime = Date.now()

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          inputs,
        }),
      })

      const data = await response.json()
      const endTime = Date.now()
      setGenerationTime(Math.round((endTime - startTime) / 1000))

      if (!response.ok) {
        throw new Error(data.error || '生成に失敗しました')
      }

      setOutput(data.output)
      setShowInputs(false)
      
      // 初回生成結果をチャット履歴に追加
      setChatMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.output,
          timestamp: new Date(),
        }
      ])
      
      toast.success('生成完了！チャットでブラッシュアップできます', { icon: '🎉' })

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (error: any) {
      toast.error(error.message || '生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  // チャットで修正依頼
  const handleChatSubmit = async (message?: string) => {
    const inputMessage = message || chatInput
    if (!inputMessage.trim() || isChatting) return
    if (isGuest && !canGuestGenerate) {
      toast.error('本日の無料お試しは上限に達しました')
      return
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatting(true)

    try {
      // 現在の出力と修正依頼を含めたプロンプト
      const refinementPrompt = `以下は先ほど生成した${template.name}の内容です：

---
${output}
---

ユーザーからの修正依頼：
${inputMessage}

上記の修正依頼を反映して、改善版を出力してください。`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'chat-refinement',
          inputs: {
            prompt: refinementPrompt,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成に失敗しました')
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.output,
        timestamp: new Date(),
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
      setOutput(data.output) // 最新の出力を更新

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (error: any) {
      toast.error(error.message || '修正に失敗しました')
    } finally {
      setIsChatting(false)
    }
  }

  // コピー
  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    toast.success('コピーしました！')
    setTimeout(() => setCopied(false), 2000)
  }

  // リセット
  const handleReset = () => {
    setOutput('')
    setInputs({})
    setChatMessages([])
    setChatInput('')
    setShowInputs(true)
    setGenerationTime(0)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-2xl blur-2xl opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'

  return (
    <div className="min-h-screen bg-white flex">
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#fff',
            color: '#333',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
        }}
      />

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
      <div className="flex-1 lg:ml-52 flex flex-col min-h-screen">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-3">
              {/* モバイルメニューボタン */}
              <button 
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/kantan/dashboard/text" className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </Link>
              <h1 className="font-bold text-gray-800 truncate max-w-[150px] lg:max-w-[300px] text-sm lg:text-base">{template.name}</h1>
            </div>
            
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

        <main className="flex-1 p-4 lg:p-6">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-4 lg:mb-6 p-3 lg:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl lg:rounded-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-blue-100 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                </div>
                <div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] lg:text-xs font-bold rounded-full">FREE TRIAL</span>
                  <p className="text-gray-500 text-xs lg:text-sm mt-1">
                    残り <span className="font-bold text-blue-600">{guestRemainingCount}回</span>
                  </p>
                </div>
              </div>
              <Link href="/auth/signin?service=kantan">
                <button className="w-full sm:w-auto px-3 lg:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs lg:text-sm font-bold rounded-lg lg:rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg">
                  <LogIn className="w-4 h-4" />
                  ログインで10回に！
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          {/* 左側：入力フォーム */}
          <div className={`lg:col-span-2 ${output && !showInputs ? 'hidden lg:block' : ''}`}>
            {/* テンプレート説明 */}
            <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-4 lg:p-5 mb-3 lg:mb-4 shadow-sm">
              <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-3">
                <FileText className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                <h2 className="font-bold text-gray-800 text-sm lg:text-base">このエージェントについて</h2>
              </div>
              <p className="text-gray-500 text-xs lg:text-sm">{template.description}</p>
            </div>

            {/* サンプル入力ボタン */}
            <button
              onClick={handleSampleInput}
              className="group w-full mb-3 lg:mb-4 py-2.5 lg:py-3 px-4 lg:px-5 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border border-blue-200 text-gray-700 font-bold rounded-xl lg:rounded-2xl transition-all flex items-center justify-center gap-2 lg:gap-3"
            >
              <Wand2 className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500 group-hover:rotate-12 transition-transform" />
              <span className="text-xs lg:text-sm">ワンクリックでサンプル入力</span>
            </button>

            {/* 入力フォーム */}
            <div className="bg-white border border-gray-200 rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h2 className="font-bold text-gray-800 text-sm lg:text-base flex items-center gap-2">
                  <span>入力項目</span>
                  <span className="text-[10px] lg:text-xs text-gray-400 font-normal">（{template.inputFields.filter(f => f.required).length}項目必須）</span>
                </h2>
              </div>
              <div className="space-y-3 lg:space-y-4">
                {template.inputFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-[10px] lg:text-xs font-medium text-gray-600 mb-1 lg:mb-1.5">
                      {field.label}
                      {field.required && <span className="text-blue-500 ml-1">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        className="w-full px-3 py-2 lg:py-2.5 bg-gray-50 border border-gray-200 rounded-lg lg:rounded-xl text-gray-800 text-xs lg:text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      >
                        <option value="">選択してください</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 lg:py-2.5 bg-gray-50 border border-gray-200 rounded-lg lg:rounded-xl text-gray-800 text-xs lg:text-sm placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 lg:py-2.5 bg-gray-50 border border-gray-200 rounded-lg lg:rounded-xl text-gray-800 text-xs lg:text-sm placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`
                  group w-full mt-4 lg:mt-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-sm lg:text-base transition-all flex items-center justify-center gap-2 lg:gap-3
                ${canGenerate && !isGenerating
                    ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 text-white shadow-xl shadow-blue-500/25 hover:scale-[1.02]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                    <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                    <Zap className="w-4 h-4 lg:w-5 lg:h-5 group-hover:rotate-12 transition-transform" />
                    AIで生成する
                </>
              )}
            </button>

            {!canGenerate && isGuest && !canGuestGenerate && (
                <p className="text-center text-xs text-gray-400 mt-3">
                本日の無料お試しは上限に達しました。
                  <Link href="/auth/signin?service=kantan" className="text-blue-500 hover:underline ml-1">
                  ログインで続ける
                </Link>
              </p>
            )}
            </div>
          </div>

          {/* 右側：出力結果とチャット */}
          <div className={`lg:col-span-3 ${!output ? 'hidden lg:flex lg:items-center lg:justify-center' : ''}`}>
            {output ? (
              <div className="space-y-4">
                {/* 生成情報 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-bold">生成完了</span>
                    </div>
                    {generationTime > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Timer className="w-3.5 h-3.5" />
                        <span>{generationTime}秒</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowInputs(!showInputs)}
                    className="lg:hidden flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600"
                  >
                    {showInputs ? '入力を隠す' : '入力を表示'}
                  </button>
                </div>

                {/* チャット履歴 */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 max-h-[50vh] overflow-y-auto shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-gray-800 text-sm">チャットでブラッシュアップ</h2>
                    <span className="text-xs text-gray-400">（何度でも修正OK）</span>
                  </div>
                  
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                            : 'bg-gray-50 border border-gray-200 text-gray-800'
                        }`}>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          {msg.role === 'assistant' && index === chatMessages.length - 1 && !isChatting && (
                            <button
                              onClick={handleCopy}
                              className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copied ? 'コピー済み' : 'コピー'}
                            </button>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isChatting && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span className="text-sm text-gray-500">修正中...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* 修正提案ボタン */}
                <div className="flex flex-wrap gap-2">
                  {REFINEMENT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleChatSubmit(suggestion)}
                      disabled={isChatting}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-xs text-gray-600 hover:text-gray-800 transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* チャット入力 */}
                <div className="relative">
                  <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
                    <div className="flex gap-3">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter は改行。送信は Ctrl/⌘+Enter のみ。
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleChatSubmit()
                          }
                        }}
                        placeholder="修正依頼を入力...（Enter=改行 / Ctrl+Enter or ⌘+Enter=送信）"
                        rows={2}
                        className="flex-1 bg-transparent text-gray-800 text-sm placeholder-gray-400 outline-none resize-none"
                        disabled={isChatting}
                      />
                      <button
                        onClick={() => handleChatSubmit()}
                        disabled={!chatInput.trim() || isChatting}
                        className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white disabled:opacity-50 hover:scale-105 transition-transform shadow-lg"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'コピー済み' : '最新をコピー'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    新しく作成
                  </button>
                </div>
              </div>
            ) : (
              // 初期状態（出力なし）
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-gray-400 text-lg mb-2">ここに生成結果が表示されます</h3>
                <p className="text-gray-300 text-sm">左の入力フォームを埋めて「AIで生成する」をクリック</p>
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}
