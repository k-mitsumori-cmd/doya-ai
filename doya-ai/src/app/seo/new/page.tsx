'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Button } from '@seo/components/ui/Button'
import { Toggle } from '@seo/components/ui/Toggle'
import { Badge } from '@seo/components/ui/Badge'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'
import {
  Sparkles,
  Wand2,
  Save,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  Settings2,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  ImageIcon,
  Lock,
  X,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { FeatureGuide } from '@/components/FeatureGuide'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SEO_PRICING } from '@/lib/pricing'

const TARGETS = [5000, 10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const
const STORAGE_KEY = 'doya_seo_new_draft_v2'

const LLMO_LABELS: Record<
  string,
  { label: string; desc: string }
> = {
  tldr: { label: '要約（先に）', desc: '冒頭で結論を短く提示し、理解を早めます。' },
  conclusionFirst: { label: '結論を先に', desc: '読者が迷わない構成にします。' },
  faq: { label: 'FAQ', desc: 'よくある疑問を補い、検索意図の取りこぼしを減らします。' },
  glossary: { label: '用語集', desc: '専門用語を補足して、初心者にも分かりやすくします。' },
  comparison: { label: '比較（軸/表）', desc: '比較軸を整理し、判断しやすい形にします。' },
  quotes: { label: '根拠・引用', desc: '根拠を補い、信頼性を高めます。' },
  templates: { label: 'テンプレ要素', desc: 'チェックリスト等の定型要素で再現性を上げます。' },
  objections: { label: '懸念への回答', desc: '反論・不安を先回りして解消します。' },
}

type ArticleTypeId = 'howto' | 'thorough' | 'note' | 'comparison'

const ARTICLE_TYPES: Array<{
  id: ArticleTypeId
  label: string
  desc: string
  badge: string
  color: { bg: string; ring: string; icon: string }
  defaultTemplateId: string
}> = [
  {
    id: 'howto',
    label: 'ハウツー/ガイド',
    desc: '手順・チェックリスト中心で「読者がやれる」記事',
    badge: '手順型',
    color: { bg: 'bg-emerald-50', ring: 'ring-emerald-300', icon: 'text-emerald-600' },
    defaultTemplateId: 'howto',
  },
  {
    id: 'thorough',
    label: '徹底解説/超長文',
    desc: '定義→比較→選び方→失敗例まで、網羅で勝つ記事',
    badge: '網羅型',
    color: { bg: 'bg-blue-50', ring: 'ring-blue-300', icon: 'text-blue-600' },
    defaultTemplateId: 'thorough',
  },
  {
    id: 'note',
    label: 'note記事',
    desc: '体験談/学び/気づきで刺す、読み物寄りの記事',
    badge: '体験型',
    color: { bg: 'bg-amber-50', ring: 'ring-amber-300', icon: 'text-amber-600' },
    defaultTemplateId: 'note',
  },
  {
    id: 'comparison',
    label: '比較記事（調査型）',
    desc: '調査→抽出→比較表→章立て→本文まで「ガチ比較」',
    badge: '調査型',
    color: { bg: 'bg-indigo-50', ring: 'ring-indigo-300', icon: 'text-indigo-600' },
    defaultTemplateId: 'cmp30',
  },
]

// よく使うテンプレート
const TEMPLATES = [
  {
    id: 'note',
    name: 'note記事',
    icon: '📝',
    title: '○○してみて気づいたこと',
    targetChars: 5000,
    searchIntent: '体験談/気づき/学び/おすすめ/読者へのメッセージ',
    llmo: { tldr: false, conclusionFirst: false, faq: false, glossary: false, comparison: false, quotes: false, templates: false, objections: false },
    isNote: true,
  },
  {
    id: 'thorough',
    name: '徹底解説・超長文記事',
    icon: '🎯',
    title: '【完全版】○○徹底解説｜50社比較・選び方・料金',
    targetChars: 50000,
    searchIntent: '定義/できること/比較表/選び方/料金相場/失敗例/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true },
  },
  {
    id: 'howto',
    name: 'ハウツー・ガイド',
    icon: '📖',
    title: '○○のやり方完全ガイド【初心者向け】',
    targetChars: 20000,
    searchIntent: '手順/注意点/よくある失敗/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: true, objections: true },
  },
  {
    id: 'cmp10',
    name: '比較記事（調査型）10社',
    icon: '🔎',
    title: '【厳選10社】○○おすすめ比較｜料金・特徴・選び方',
    targetChars: 20000,
    searchIntent: '比較表/選び方/料金相場/おすすめ/向いている企業/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true },
    mode: 'comparison_research' as const,
    comparison: { template: 'comparison', count: 10 },
  },
  {
    id: 'cmp30',
    name: '比較記事（調査型）30社',
    icon: '🏁',
    title: '○○おすすめ比較30選｜料金・特徴・選び方【最新版】',
    targetChars: 30000,
    searchIntent: '比較表/ランキング/選び方/料金相場/導入手順/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true },
    mode: 'comparison_research' as const,
    comparison: { template: 'comparison', count: 30 },
  },
  {
    id: 'cmp50',
    name: '比較記事（調査型）50社',
    icon: '🏆',
    title: '○○おすすめ比較50選｜選び方と料金相場【最新版】',
    targetChars: 50000,
    searchIntent: '比較表/ランキング/選び方/料金相場/失敗例/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true },
    mode: 'comparison_research' as const,
    comparison: { template: 'ranking', count: 50 },
  },
]

export default function SeoNewArticlePage() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const userPlan = useMemo(() => {
    if (!isLoggedIn) return 'GUEST' as const
    const seoPlan = (session?.user as any)?.seoPlan
    const plan = (session?.user as any)?.plan
    const p = String(seoPlan || plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE' as const
    if (p === 'PRO') return 'PRO' as const
    return 'FREE' as const
  }, [session, isLoggedIn])

  const charLimit = useMemo(() => {
    const lim = SEO_PRICING.charLimit
    if (!lim) return isLoggedIn ? 10000 : 5000
    if (userPlan === 'ENTERPRISE') return lim.enterprise
    if (userPlan === 'PRO') return lim.pro
    if (userPlan === 'FREE') return lim.free
    return lim.guest
  }, [userPlan, isLoggedIn])

  const [mode, setMode] = useState<'standard' | 'comparison_research'>('standard')
  const [articleType, setArticleType] = useState<ArticleTypeId>('howto')
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [targetChars, setTargetChars] = useState(30000)
  const [tone, setTone] = useState<typeof TONES[number]>('丁寧')
  const [persona, setPersona] = useState('')
  const [searchIntent, setSearchIntent] = useState('')
  const [referenceUrls, setReferenceUrls] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [requestText, setRequestText] = useState('')
  const [referenceImages, setReferenceImages] = useState<{ name: string; dataUrl: string }[]>([])
  const [autoBundle, setAutoBundle] = useState(true) // セット生成フラグ

  // 比較記事（調査型）: 参考記事入力
  const [refUrlInput, setRefUrlInput] = useState('')
  const [refItems, setRefItems] = useState<
    Array<{
      id: string
      kind: 'url' | 'paste' | 'file'
      url?: string
      title?: string | null
      host?: string | null
      ogImage?: string | null
      status: 'idle' | 'fetching' | 'ready' | 'error' | 'parsed'
      error?: string | null
      text?: string
      headings?: { h2: string[]; h3: string[] }
      template?: any
    }>
  >([])
  const [refPaste, setRefPaste] = useState('')

  // 比較記事（調査型）: 候補企業
  const [cmpTemplate, setCmpTemplate] = useState<'comparison' | 'ranking' | 'price' | 'feature'>('comparison')
  const [cmpCount, setCmpCount] = useState<10 | 30 | 50>(30)
  const [cmpRegion, setCmpRegion] = useState<'JP' | 'GLOBAL'>('JP')
  const [cmpExclude, setCmpExclude] = useState('')
  const [cmpTags, setCmpTags] = useState('')
  const [cmpRequireOfficial, setCmpRequireOfficial] = useState(true)
  const [cmpIncludeThirdParty, setCmpIncludeThirdParty] = useState(true)
  const [candidates, setCandidates] = useState<Array<{ name: string; websiteUrl?: string; notes?: string }>>([])
  const [candidateName, setCandidateName] = useState('')
  const [candidateUrl, setCandidateUrl] = useState('')

  const [llmo, setLlmo] = useState({
    tldr: true,
    conclusionFirst: true,
    faq: true,
    glossary: false,
    comparison: true,
    quotes: true,
    templates: true,
    objections: true,
  })

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCta, setErrorCta] = useState<null | { label: string; href: string }>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const keywordList = useMemo(() => {
    return keywords.split(/[,、\s]+/).filter(Boolean)
  }, [keywords])

  const canSubmit = title.trim().length > 0 && keywordList.length > 0

  // 上限超過が入っていたらクランプ（ロック表示と整合させる）
  useEffect(() => {
    setTargetChars((prev) => Math.min(Number(prev || 0) || 0, charLimit))
  }, [charLimit])

  const fadeUp = useMemo(
    () => ({
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 6 },
      transition: { duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' as const },
    }),
    [reduceMotion]
  )

  // サンプルデータ定義
  const SAMPLES = [
    {
      id: 'rpo',
      name: 'RPO（採用代行）比較',
      mode: 'comparison_research' as const,
      articleType: 'comparison' as ArticleTypeId,
      title: 'RPO（採用代行）おすすめ比較50選｜選び方と料金相場【2024年最新】',
      keywords: 'RPO, 採用代行, 比較, 料金, おすすめ',
      targetChars: 50000,
      persona: '採用に課題を感じている企業の人事責任者、経営層。コスト削減と採用質向上を両立させたい層。',
      searchIntent: 'RPOの主要プレイヤーを一覧で比較したい。自社に合うサービスの選び方を知りたい。相場感と導入メリットを把握したい。',
      cmpTemplate: 'ranking' as const,
      cmpCount: 50 as const,
    },
    {
      id: 'ai-writing',
      name: 'AIライティングツール比較',
      mode: 'comparison_research' as const,
      articleType: 'comparison' as ArticleTypeId,
      title: 'AIライティングツールおすすめ30選｜機能・料金・精度で徹底比較【2024年版】',
      keywords: 'AIライティング, 文章生成AI, 記事作成ツール, 比較',
      targetChars: 30000,
      persona: 'コンテンツマーケター、ブロガー、企業のマーケティング担当者。記事作成の効率化を図りたい層。',
      searchIntent: 'AIライティングツールの種類を知りたい。自社に合うツールを選びたい。料金と精度のバランスを比較したい。',
      cmpTemplate: 'comparison' as const,
      cmpCount: 30 as const,
    },
    {
      id: 'crm',
      name: 'CRM（顧客管理）ツール比較',
      mode: 'comparison_research' as const,
      articleType: 'comparison' as ArticleTypeId,
      title: 'CRMツールおすすめ比較20選｜中小企業向け・大企業向け別に解説【2024年】',
      keywords: 'CRM, 顧客管理, SFA, 比較, おすすめ',
      targetChars: 30000,
      persona: '営業部門の責任者、IT担当者。顧客管理の効率化と売上向上を目指す企業。',
      searchIntent: 'CRMツールの選び方を知りたい。自社規模に合ったツールを見つけたい。導入コストと効果を比較したい。',
      cmpTemplate: 'comparison' as const,
      cmpCount: 30 as const,
    },
    {
      id: 'seo-howto',
      name: 'SEO対策ガイド（ハウツー）',
      mode: 'standard' as const,
      articleType: 'howto' as ArticleTypeId,
      title: 'SEO対策の完全ガイド｜初心者でもできる10ステップ【2024年版】',
      keywords: 'SEO対策, やり方, 初心者, Google検索',
      targetChars: 20000,
      persona: 'Webサイト運営者、ブロガー、マーケティング初心者。SEOの基礎から学びたい人。',
      searchIntent: 'SEO対策の具体的な手順を知りたい。初心者でも実践できる方法を学びたい。',
      cmpTemplate: 'comparison' as const,
      cmpCount: 10 as const,
    },
    {
      id: 'dx-explanation',
      name: 'DX推進（徹底解説）',
      mode: 'standard' as const,
      articleType: 'thorough' as ArticleTypeId,
      title: 'DX（デジタルトランスフォーメーション）とは？成功事例と進め方を徹底解説',
      keywords: 'DX, デジタルトランスフォーメーション, 導入, 事例',
      targetChars: 40000,
      persona: '経営者、事業責任者、IT部門担当者。自社のDX推進を検討している企業。',
      searchIntent: 'DXの定義と必要性を理解したい。成功事例から学びたい。自社での進め方を知りたい。',
      cmpTemplate: 'comparison' as const,
      cmpCount: 10 as const,
    },
    {
      id: 'startup-note',
      name: '起業体験談（note記事）',
      mode: 'standard' as const,
      articleType: 'note' as ArticleTypeId,
      title: '1年間で売上ゼロから月商1000万円達成するまでにやったこと',
      keywords: '起業, スタートアップ, 売上, 成長',
      targetChars: 5000,
      persona: '起業を考えている人、スタートアップ経営者、ビジネスに興味がある人。',
      searchIntent: 'リアルな起業体験を知りたい。成功のコツや失敗談を学びたい。',
      cmpTemplate: 'comparison' as const,
      cmpCount: 10 as const,
    },
  ]

  const [showSampleMenu, setShowSampleMenu] = useState(false)

  // 1. サンプル入力
  function fillSample(sampleId?: string) {
    const sample = sampleId ? SAMPLES.find(s => s.id === sampleId) : SAMPLES[0]
    if (!sample) return

    setMode(sample.mode)
    setArticleType(sample.articleType)
    setTitle(sample.title)
    setKeywords(sample.keywords)
    setTargetChars(sample.targetChars)
    setPersona(sample.persona)
    setSearchIntent(sample.searchIntent)
    setLlmo({
      tldr: true,
      conclusionFirst: true,
      faq: true,
      glossary: sample.mode === 'comparison_research',
      comparison: sample.mode === 'comparison_research',
      quotes: true,
      templates: true,
      objections: true,
    })
    if (sample.mode === 'comparison_research') {
      setCmpTemplate(sample.cmpTemplate)
      setCmpCount(sample.cmpCount)
      setCmpRegion('JP')
      setCmpRequireOfficial(true)
      setCmpIncludeThirdParty(true)
    }
    setCandidates([])
    setRefItems([])
    setShowSampleMenu(false)
    setNotice(`サンプル「${sample.name}」を入力しました`)
    setTimeout(() => setNotice(null), 3000)
  }

  // 2. ドラフト保存・読込
  function saveDraft() {
    const data = {
      mode,
      articleType,
      title,
      keywords,
      targetChars,
      tone,
      persona,
      searchIntent,
      referenceUrls,
      forbidden,
      llmo,
      autoBundle,
      requestText,
      refItems,
      refPaste,
      cmpTemplate,
      cmpCount,
      cmpRegion,
      cmpExclude,
      cmpTags,
      cmpRequireOfficial,
      cmpIncludeThirdParty,
      candidates,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setNotice('ドラフトを保存しました')
    setTimeout(() => setNotice(null), 3000)
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.mode) setMode(data.mode)
        if (data.articleType) setArticleType(data.articleType)
        if (data.title) setTitle(data.title)
        if (data.keywords) setKeywords(data.keywords)
        if (data.targetChars) setTargetChars(data.targetChars)
        if (data.tone) setTone(data.tone)
        if (data.persona) setPersona(data.persona)
        if (data.searchIntent) setSearchIntent(data.searchIntent)
        if (data.referenceUrls) setReferenceUrls(data.referenceUrls)
        if (data.forbidden) setForbidden(data.forbidden)
        if (data.llmo) setLlmo(data.llmo)
        if (data.autoBundle !== undefined) setAutoBundle(data.autoBundle)
        if (data.requestText) setRequestText(data.requestText)
        if (Array.isArray(data.refItems)) setRefItems(data.refItems)
        if (typeof data.refPaste === 'string') setRefPaste(data.refPaste)
        if (data.cmpTemplate) setCmpTemplate(data.cmpTemplate)
        if (data.cmpCount) setCmpCount(data.cmpCount)
        if (data.cmpRegion) setCmpRegion(data.cmpRegion)
        if (typeof data.cmpExclude === 'string') setCmpExclude(data.cmpExclude)
        if (typeof data.cmpTags === 'string') setCmpTags(data.cmpTags)
        if (typeof data.cmpRequireOfficial === 'boolean') setCmpRequireOfficial(data.cmpRequireOfficial)
        if (typeof data.cmpIncludeThirdParty === 'boolean') setCmpIncludeThirdParty(data.cmpIncludeThirdParty)
        if (Array.isArray(data.candidates)) setCandidates(data.candidates)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // 3. AI推定（タイトルからペルソナ等を推測）
  async function predictFromTitle() {
    if (!title.trim()) return
    setPredicting(true)
    setError(null)
    try {
      const res = await fetch('/api/seo/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, keywords: keywordList }),
      })
      const json = await res.json()
      if (json.success) {
        if (json.persona) setPersona(json.persona)
        if (json.searchIntent) setSearchIntent(json.searchIntent)
        setNotice('AIがターゲットと検索意図を推定しました ✨')
        setTimeout(() => setNotice(null), 3000)
      }
    } catch (e) {
      // ignore
    } finally {
      setPredicting(false)
    }
  }

  // 4. テンプレート適用
  function applyTemplate(t: typeof TEMPLATES[number]) {
    setTitle(t.title)
    setTargetChars(t.targetChars)
    setSearchIntent(t.searchIntent)
    setLlmo(t.llmo)
    // 比較記事テンプレの場合
    if ((t as any).mode === 'comparison_research') {
      setMode('comparison_research')
      setArticleType('comparison')
      const cc = (t as any).comparison?.count
      const tt = (t as any).comparison?.template
      if (cc === 10 || cc === 30 || cc === 50) setCmpCount(cc)
      if (tt === 'comparison' || tt === 'ranking' || tt === 'price' || tt === 'feature') setCmpTemplate(tt)
      setCmpRequireOfficial(true)
      setCmpIncludeThirdParty(true)
    } else {
      setMode('standard')
      if (t.id === 'note' || t.id === 'howto' || t.id === 'thorough') {
        setArticleType(t.id as ArticleTypeId)
      }
    }
    setNotice(`${t.name}テンプレートを適用しました`)
    setTimeout(() => setNotice(null), 3000)
  }

  function applyArticleType(typeId: ArticleTypeId) {
    setArticleType(typeId)
    const def = ARTICLE_TYPES.find((t) => t.id === typeId)
    const tpl = TEMPLATES.find((t) => t.id === def?.defaultTemplateId)
    if (tpl) applyTemplate(tpl)
  }

  const preview = useMemo(() => {
    const def = ARTICLE_TYPES.find((t) => t.id === articleType)
    const base = {
      title: (title || def?.label || '記事タイトル').trim(),
      bullets: [] as string[],
      sections: [] as string[],
      hasTable: false,
      flow: [] as string[],
    }
    if (articleType === 'note') {
      return {
        ...base,
        bullets: ['導入（背景）', 'やってみたこと', '気づき', '読者への提案'],
        sections: ['共感を取る導入', '体験ベースの具体例', '学びの整理', 'まとめ'],
        hasTable: false,
        flow: ['構成案', '本文（体験談）', '読みやすく整形', '完成'],
      }
    }
    if (articleType === 'howto') {
      return {
        ...base,
        bullets: ['結論（先に）', '手順', '注意点', 'チェックリスト', 'FAQ'],
        sections: ['手順（ステップ）', '失敗しがちなポイント', 'コピペ用チェックリスト', 'FAQ'],
        hasTable: false,
        flow: ['構成案', '本文（手順）', 'チェックリスト', 'FAQ', '完成'],
      }
    }
    if (articleType === 'thorough') {
      return {
        ...base,
        bullets: ['定義', 'できること', '比較表', '選び方', '料金相場', '失敗例', 'FAQ'],
        sections: ['定義と前提', '比較軸で整理', '用途別おすすめ', '失敗回避', 'FAQ'],
        hasTable: true,
        flow: ['構成案', '分割本文', '統合', '図解/サムネ', '完成'],
      }
    }
    // comparison
    return {
      ...base,
      bullets: ['評価軸', '比較表', 'ランキング/おすすめ', '各社解説', '選び方', 'FAQ'],
      sections: ['評価基準（根拠）', '比較表（一覧）', '各社の強み/弱み', '選び方', 'FAQ'],
      hasTable: true,
      flow: [
        '参考記事解析',
        '候補収集→確定',
        '公式サイト巡回',
        '情報抽出',
        '比較表生成',
        '章立て→本文',
        '校正（表現調整）',
        '完成',
      ],
    }
  }, [articleType, title])

  function addRefUrl() {
    const url = refUrlInput.trim()
    if (!url) return
    try {
      // validate
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      setError('URLの形式が正しくありません')
      return
    }
    const id = `url_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setRefItems((prev) => [
      ...prev,
      { id, kind: 'url', url, status: 'fetching', title: null, host: null, ogImage: null, error: null },
    ])
    setRefUrlInput('')
    ;(async () => {
      try {
        const res = await fetch('/api/seo/reference/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [url] }),
        })
        const json = await res.json().catch(() => ({}))
        const item = Array.isArray(json?.items) ? json.items[0] : null
        setRefItems((prev) =>
          prev.map((x) =>
            x.id !== id
              ? x
              : {
                  ...x,
                  status: item?.ok ? 'ready' : 'error',
                  title: item?.title ?? null,
                  host: item?.host ?? null,
                  ogImage: item?.ogImage ?? null,
                  error: item?.ok ? null : String(item?.error || '取得に失敗しました'),
                }
          )
        )
      } catch (e: any) {
        setRefItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error', error: e?.message || '失敗しました' } : x)))
      }
    })()
  }

  async function parseRefItem(id: string) {
    const item = refItems.find((x) => x.id === id)
    if (!item) return
    setRefItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'fetching', error: null } : x)))
    try {
      const res = await fetch('/api/seo/reference/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.kind === 'url' ? { url: item.url } : { text: item.text || '', titleHint: item.title || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `API Error: ${res.status}`)
      setRefItems((prev) =>
        prev.map((x) =>
          x.id !== id
            ? x
            : { ...x, status: 'parsed', headings: json.headings || x.headings, template: json.template || x.template }
        )
      )
    } catch (e: any) {
      setRefItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error', error: e?.message || '失敗しました' } : x)))
    }
  }

  function addPasteRef() {
    const text = refPaste.trim()
    if (!text) return
    const id = `paste_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setRefItems((prev) => [
      ...prev,
      { id, kind: 'paste', status: 'ready', title: '貼り付け', host: null, ogImage: null, error: null, text },
    ])
    setRefPaste('')
    setNotice('貼り付け参考を追加しました（必要なら「解析」してください）')
    setTimeout(() => setNotice(null), 2500)
  }

  const [searchApiNotConfigured, setSearchApiNotConfigured] = useState(false)

  async function autoCollectCandidates() {
    setError(null)
    setNotice(null)
    setSearchApiNotConfigured(false)
    const query = title.trim() || keywordList.join(' ')
    if (!query) {
      setError('タイトルまたはキーワードを入力してください')
      return
    }
    try {
      const res = await fetch('/api/seo/compare/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          count: cmpCount,
          region: cmpRegion,
          exclude: cmpExclude.split(/[,、\n]+/).map((s) => s.trim()).filter(Boolean),
          tags: cmpTags.split(/[,、\n]+/).map((s) => s.trim()).filter(Boolean),
          requireOfficial: cmpRequireOfficial,
          includeThirdParty: cmpIncludeThirdParty,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        // 検索APIキー未設定エラーの特別処理
        if (json?.code === 'SEARCH_PROVIDER_NOT_CONFIGURED') {
          setSearchApiNotConfigured(true)
          return
        }
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      const list = Array.isArray(json?.candidates) ? json.candidates : []
      setCandidates(
        list
          .map((c: any) => ({
            name: String(c?.name || '').trim(),
            websiteUrl: typeof c?.websiteUrl === 'string' ? c.websiteUrl : undefined,
            notes: typeof c?.notes === 'string' ? c.notes : undefined,
          }))
          .filter((c: any) => c.name)
      )
      setNotice('候補リストを生成しました（編集して確定してください）')
      setTimeout(() => setNotice(null), 3000)
    } catch (e: any) {
      setError(e?.message || '候補収集に失敗しました')
    }
  }

  function addCandidateManual() {
    const name = candidateName.trim()
    if (!name) return
    const url = candidateUrl.trim()
    setCandidates((prev) => [...prev, { name, ...(url ? { websiteUrl: url } : {}) }])
    setCandidateName('')
    setCandidateUrl('')
  }

  // 5. 画像アップロード
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReferenceImages(prev => [...prev, { name: file.name, dataUrl: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }

  // 6. 送信
  async function submit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setErrorCta(null)
    try {
      const urls = referenceUrls.split('\n').map(u => u.trim()).filter(Boolean)
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title,
          keywords: keywordList,
          targetChars,
          tone,
          persona,
          searchIntent,
          referenceUrls: Array.from(new Set([...urls, ...refItems.filter((x) => x.kind === 'url' && x.url).map((x) => x.url as string)])),
          forbidden: forbidden.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean),
          llmoOptions: llmo,
          requestText,
          referenceImages,
          autoBundle,
          comparisonConfig:
            mode === 'comparison_research'
              ? {
                  template: cmpTemplate,
                  count: cmpCount,
                  region: cmpRegion,
                  exclude: cmpExclude.split(/[,、\n]+/).map((s) => s.trim()).filter(Boolean),
                  tags: cmpTags.split(/[,、\n]+/).map((s) => s.trim()).filter(Boolean),
                  requireOfficial: cmpRequireOfficial,
                  includeThirdParty: cmpIncludeThirdParty,
                }
              : null,
          comparisonCandidates: mode === 'comparison_research' ? candidates : null,
          referenceInputs: mode === 'comparison_research' ? refItems : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (res.status === 429) setErrorCta({ label: '料金/プランを見る', href: '/seo/pricing' })
        else if (res.status === 401) setErrorCta({ label: 'ログインする', href: '/auth/signin' })
        throw new Error(json.error || '作成に失敗しました')
      }

      // ドラフト削除
      localStorage.removeItem(STORAGE_KEY)
      // 記事詳細へ（自動実行フラグ付き）
      router.push(`/seo/articles/${json.articleId}?auto=1`)
    } catch (e: any) {
      setError(e?.message || '不明なエラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
        {/* Header */}
        <motion.div {...fadeUp} className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <button
              onClick={() => router.push('/seo')}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 text-xs sm:text-sm mb-2 sm:mb-4 transition-colors font-bold group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              一覧へ戻る
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">新規記事作成</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">高品質な記事とビジュアルをワンセットで生成します。</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSampleMenu(!showSampleMenu)} 
                className="w-full text-gray-400 hover:text-blue-600 border border-gray-100 sm:border-none"
              >
                <Sparkles className="w-4 h-4 mr-2" /> サンプル
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showSampleMenu ? 'rotate-180' : ''}`} />
              </Button>
              <AnimatePresence>
                {showSampleMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">サンプルを選択</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {SAMPLES.map((sample) => (
                        <button
                          key={sample.id}
                          onClick={() => fillSample(sample.id)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                        >
                          <p className="text-sm font-black text-gray-900">{sample.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{sample.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              sample.mode === 'comparison_research' 
                                ? 'bg-indigo-50 text-indigo-600' 
                                : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {sample.mode === 'comparison_research' ? '比較記事' : '通常記事'}
                            </span>
                            <span className="text-[10px] text-gray-400">{sample.targetChars.toLocaleString()}字</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 sm:flex-none">
              <FeatureGuide 
                featureId="seo-new-simplified"
                title="進化した記事作成"
                description="タイトルとキーワードを入れるだけで、AIが最適な構成案から本文、さらには図解やアイキャッチまで一気に作り上げます。"
                steps={[
                  "作りたい記事の「タイトル」と「キーワード」を入力します。",
                  "「AI推定」でターゲット設定を自動化できます。",
                  "「記事を生成」をクリックして、完成を待つだけです。"
                ]}
                imageMode="off"
              />
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {notice && (
            <motion.div key="notice" {...fadeUp} className="mb-6 p-4 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-700 text-sm font-bold flex items-center gap-3 border border-blue-100 shadow-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              {notice}
            </motion.div>
          )}
          {error && (
            <motion.div key="error" {...fadeUp} className="mb-6 p-4 rounded-xl sm:rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <p className="font-bold flex items-center gap-2"><X className="w-4 h-4" /> エラーが発生しました</p>
              <p className="mt-1 ml-6 whitespace-pre-wrap break-words">{error}</p>
              {errorCta && (
                <div className="mt-3 ml-6">
                  <Link href={errorCta.href}>
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl bg-white border border-red-200 text-red-700 font-black text-xs hover:bg-red-50 transition-colors"
                    >
                      {errorCta.label}
                    </button>
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className="space-y-6 sm:space-y-8">
          {/* Simple Inputs Card */}
          <motion.div layout whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
            <div className="grid gap-6 sm:gap-8">
              <div>
                <label className="block text-[10px] sm:text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">記事タイトル</label>
                <input
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-lg sm:text-xl font-bold"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例）採用代行（RPO）おすすめ比較50選"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">キーワード</label>
                <input
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="RPO, 採用代行, 比較（カンマ区切り）"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] sm:text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">目標文字数</label>
                  <p className="text-[10px] text-gray-400 font-bold mb-2">
                    ({userPlan === 'GUEST' ? 'ゲスト' : userPlan === 'FREE' ? '無料' : userPlan === 'PRO' ? 'プロ' : 'エンタープライズ'}プラン: 最大{charLimit.toLocaleString()}字)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {TARGETS.map((n) => {
                      const selected = targetChars === n
                      const locked = n > charLimit
                      const requiredPlan = n >= 50000 ? 'ENTERPRISE' : n > 10000 ? 'PRO' : n > 5000 ? 'FREE' : 'GUEST'
                      const requiredLabel =
                        requiredPlan === 'ENTERPRISE' ? 'Enterpriseが必要' : requiredPlan === 'PRO' ? 'PROが必要' : requiredPlan === 'FREE' ? 'ログインが必要' : 'ゲストOK'
                      const hint = locked ? `${requiredLabel}（クリックで料金プランへ）` : `${n.toLocaleString()}字を選択`
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (locked) {
                              window.location.href = '/seo/pricing'
                              return
                            }
                            setTargetChars(n)
                          }}
                          title={hint}
                          className={`relative p-3 rounded-xl border-2 text-center transition-all overflow-hidden ${
                            selected
                              ? 'border-blue-500 bg-blue-50'
                              : locked
                                ? 'border-gray-100 bg-gray-50 opacity-80 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          {locked && (
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute inset-0 bg-white/35" />
                              <div className="absolute right-2 top-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900/85 text-white text-[9px] font-black shadow">
                                <Lock className="w-3 h-3" />
                                {requiredPlan === 'ENTERPRISE' ? 'Enterprise' : requiredPlan === 'PRO' ? 'PRO' : 'LOGIN'}
                              </div>
                            </div>
                          )}
                          <p className={`text-sm font-black ${selected ? 'text-blue-600' : 'text-gray-700'}`}>{n.toLocaleString()}字</p>
                          {locked && <p className="text-[10px] font-black text-gray-500 mt-1">{requiredLabel}</p>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">文章トーン</label>
                  <select
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold appearance-none"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Article Type Picker + Preview */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">記事タイプ</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {ARTICLE_TYPES.map((t) => {
                const active = articleType === t.id
                return (
                  <motion.button
                    key={t.id}
                    onClick={() => applyArticleType(t.id)}
                    whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                    className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all text-left group ${
                      active
                        ? `bg-white border-gray-900 ring-2 ${t.color.ring} shadow-xl`
                        : 'bg-white border-gray-100 hover:border-blue-500 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-11 h-11 rounded-2xl ${t.color.bg} border border-white flex items-center justify-center`}>
                        <FileText className={`w-5 h-5 ${t.color.icon}`} />
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-100'
                        }`}
                      >
                        {t.badge}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-black text-gray-900 group-hover:text-blue-600">{t.label}</p>
                    <p className="text-[11px] text-gray-500 mt-1 font-bold leading-relaxed">{t.desc}</p>
                  </motion.button>
                )
              })}
            </div>

            <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    作成イメージ（完成物の見え方）
                  </h3>
                  <p className="text-xs font-bold text-gray-400 mt-1">
                    選んだ記事タイプに合わせて「構成・比較表・図解/サムネ」の出力イメージを切り替えます。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gray-50 text-gray-700 border border-gray-100">本文</Badge>
                  <Badge className="bg-gray-50 text-gray-700 border border-gray-100">図解</Badge>
                  <Badge className="bg-gray-50 text-gray-700 border border-gray-100">サムネ</Badge>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={articleType}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
                  className="mt-6 grid lg:grid-cols-5 gap-6"
                >
                {/* Left: structure */}
                <div className="lg:col-span-3 rounded-3xl border border-gray-100 bg-gray-50/40 p-5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Structure</p>
                  <div className="rounded-2xl bg-white border border-gray-100 p-4">
                    <p className="text-sm font-black text-gray-900">{preview.title}</p>
                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">見出し</p>
                        <ul className="mt-2 space-y-1">
                          {preview.bullets.slice(0, 6).map((b) => (
                            <li key={b} className="text-xs font-bold text-gray-600">- {b}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">中身</p>
                        <ul className="mt-2 space-y-1">
                          {preview.sections.slice(0, 6).map((b) => (
                            <li key={b} className="text-xs font-bold text-gray-600">- {b}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {preview.hasTable && (
                      <div className="mt-3 p-3 rounded-2xl bg-white border border-gray-100 overflow-hidden">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">比較表イメージ</p>
                        <div className="grid grid-cols-4 gap-2 text-[10px] font-black">
                          {['会社', '料金', '強み', 'おすすめ'].map((h) => (
                            <div key={h} className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-600">{h}</div>
                          ))}
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-8 rounded-xl bg-gray-50 border border-gray-100" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: assets + flow */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-3xl border border-gray-100 bg-gray-50/40 p-5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Assets</p>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-gray-800 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-blue-600" /> サムネ（BANNER）
                        </p>
                        <span className="text-[10px] font-black text-gray-400">16:9</span>
                      </div>
                      <div className="mt-3 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 border border-white shadow-inner" />
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs font-black text-gray-800 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-indigo-600" /> 図解（DIAGRAM）
                        </p>
                        <span className="text-[10px] font-black text-gray-400">1:1 ×2</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="h-20 rounded-2xl bg-gray-100 border border-white shadow-inner" />
                        <div className="h-20 rounded-2xl bg-gray-100 border border-white shadow-inner" />
                      </div>
                      <p className="mt-3 text-[10px] font-bold text-gray-400">
                        ※実際の生成は本文に合わせて自動で最適化します
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-gray-50/40 p-5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Flow</p>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
                      {preview.flow.slice(0, 10).map((s, i) => (
                        <div key={`${s}_${i}`} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-gray-900 text-white flex items-center justify-center text-[10px] font-black">
                            {i + 1}
                          </div>
                          <p className="text-xs font-bold text-gray-700">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Quick Templates (filtered by type) */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Quick Templates</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TEMPLATES.filter((t: any) => {
                  if (articleType === 'comparison') return String((t as any).mode || '') === 'comparison_research'
                  return !String((t as any).mode || '')
                }).map((t) => (
                  <motion.button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                  >
                    <span className="text-2xl mb-2 block">{t.icon}</span>
                    <p className="text-sm font-black text-gray-900 leading-tight group-hover:text-blue-600">{t.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">{t.targetChars.toLocaleString()} CHARS</p>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Mode (Research) */}
          <AnimatePresence initial={false}>
          {mode === 'comparison_research' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Reference Articles */}
              <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      参考記事（テンプレの起点）
                    </h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      URL / ファイル / 貼り付け から「見出し構造・比較軸・表・FAQ」を抽出し、今回の記事に反映します。
                    </p>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border border-blue-100">最重要</Badge>
                </div>

                {/* URL input */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={refUrlInput}
                    onChange={(e) => setRefUrlInput(e.target.value)}
                    placeholder="参考URLを貼り付け（複数OK）"
                    className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-50 bg-gray-50/50 font-bold text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    onClick={addRefUrl}
                    className="h-12 px-5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors"
                  >
                    追加
                  </button>
                </div>

                {/* Paste */}
                <div className="mt-4 grid gap-3">
                  <textarea
                    value={refPaste}
                    onChange={(e) => setRefPaste(e.target.value)}
                    placeholder="記事本文をここに貼り付け（見出し解析に使えます）"
                    className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 text-sm min-h-[120px] focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={addPasteRef}
                      className="h-11 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 transition-colors"
                    >
                      貼り付けを追加
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="mt-6 space-y-3">
                  {refItems.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 text-gray-500 text-sm font-bold">
                      参考記事を追加すると、比較軸や表の型を“ガチ”に寄せられます。
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                    {refItems.map((it) => (
                      <motion.div
                        layout
                        key={it.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
                        className="p-4 rounded-2xl border border-gray-100 bg-white flex items-start gap-4"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 font-black flex-shrink-0">
                          {it.kind === 'url' ? 'URL' : it.kind === 'paste' ? 'TXT' : 'FILE'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900 truncate">
                            {it.kind === 'url' ? it.title || it.url : it.title || '貼り付け'}
                          </p>
                          {it.kind === 'url' && (
                            <p className="text-xs font-bold text-gray-400 truncate">{it.host || it.url}</p>
                          )}
                          {it.status === 'error' && (
                            <p className="text-xs font-black text-red-600 mt-1">{it.error || '失敗しました'}</p>
                          )}
                          {it.headings?.h2?.length ? (
                            <p className="text-xs font-bold text-gray-500 mt-2">
                              抽出見出し: H2 {it.headings.h2.length}件 / H3 {it.headings.h3?.length || 0}件
                            </p>
                          ) : null}
                          {it.template?.axes?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {it.template.axes.slice(0, 6).map((a: string) => (
                                <span key={a} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => parseRefItem(it.id)}
                            disabled={it.status === 'fetching'}
                            className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors disabled:opacity-60"
                          >
                            {it.status === 'fetching' ? '解析中…' : '解析'}
                          </button>
                          <button
                            onClick={() => setRefItems((prev) => prev.filter((x) => x.id !== it.id))}
                            className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-50 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>

              {/* Candidate Collection */}
              <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-600" />
                      比較対象の収集（候補→確定）
                    </h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      “候補を自動収集”で叩き台を作り、削除/追加/順序を整えて「確定リスト」にします。
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">テンプレ種別</p>
                    <select
                      value={cmpTemplate}
                      onChange={(e) => setCmpTemplate(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="comparison">比較記事（調査型）</option>
                      <option value="ranking">ランキング（スコアリング）</option>
                      <option value="price">料金比較（表重視）</option>
                      <option value="feature">機能比較（要件別おすすめ）</option>
                    </select>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">比較対象数</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 30, 50].map((n) => (
                        <button
                          key={n}
                          onClick={() => setCmpCount(n as any)}
                          className={`h-11 rounded-xl font-black text-sm transition-all ${
                            cmpCount === n ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {n}社
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">対象地域</p>
                    <select
                      value={cmpRegion}
                      onChange={(e) => setCmpRegion(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="JP">日本（初期）</option>
                      <option value="GLOBAL">グローバル</option>
                    </select>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">参照方針（推奨）</p>
                    <div className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs font-black text-gray-900">公式サイト必須</p>
                        <p className="text-[10px] font-bold text-gray-400">ON推奨（根拠がブレにくい）</p>
                      </div>
                      <Toggle checked={cmpRequireOfficial} onChange={setCmpRequireOfficial} label="" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs font-black text-gray-900">口コミ/第三者情報も参照</p>
                        <p className="text-[10px] font-bold text-gray-400">ON推奨（比較が深くなる）</p>
                      </div>
                      <Toggle checked={cmpIncludeThirdParty} onChange={setCmpIncludeThirdParty} label="" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">除外条件</p>
                    <textarea
                      value={cmpExclude}
                      onChange={(e) => setCmpExclude(e.target.value)}
                      placeholder="例：派遣のみは除外、SEO会社は除外..."
                      className="w-full p-3 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[78px] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">優先する業界/カテゴリ</p>
                    <textarea
                      value={cmpTags}
                      onChange={(e) => setCmpTags(e.target.value)}
                      placeholder="例：IT、人材、ベンチャー..."
                      className="w-full p-3 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[78px] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 検索APIキー未設定の通知 */}
                {searchApiNotConfigured && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-5 rounded-2xl bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-amber-800">自動収集は現在利用できません</p>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          検索APIキー（SEO_SERPAPI_KEY）が設定されていないため、候補の自動収集はご利用いただけません。<br />
                          下の「手動追加」から、比較したい企業・サービスを直接入力してください。
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
                            ✓ 手動追加で記事作成できます
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSearchApiNotConfigured(false)}
                        className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={autoCollectCandidates}
                    className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
                  >
                    候補を自動収集する
                  </button>
                  <div className="flex-1 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">手動追加</p>
                    <div className="flex gap-2">
                      <input
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="会社名"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-100 bg-white text-sm font-bold"
                      />
                      <input
                        value={candidateUrl}
                        onChange={(e) => setCandidateUrl(e.target.value)}
                        placeholder="公式URL（任意）"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-100 bg-white text-sm font-bold"
                      />
                      <button
                        onClick={addCandidateManual}
                        className="px-4 py-2 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-800"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">確定リスト（編集可能）</p>
                  {candidates.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 text-gray-500 text-sm font-bold">
                      ここに確定した企業だけを深掘り調査します（削除/追加して整えてください）。
                    </div>
                  ) : (
                    <motion.div layout className="space-y-2">
                      <AnimatePresence mode="popLayout">
                      {candidates.map((c, idx) => (
                        <motion.div
                          layout
                          key={`${c.name}_${idx}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2 }}
                          className="p-4 rounded-2xl border border-gray-100 bg-white flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-black text-xs">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{c.name}</p>
                            {c.websiteUrl ? (
                              <p className="text-xs font-bold text-gray-400 truncate">{c.websiteUrl}</p>
                            ) : (
                              <p className="text-xs font-bold text-gray-300">公式URL未設定（後で推定/補完できます）</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setCandidates((prev) => {
                                  if (idx === 0) return prev
                                  const next = [...prev]
                                  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                  return next
                                })
                              }
                              className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-50"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() =>
                                setCandidates((prev) => {
                                  if (idx === prev.length - 1) return prev
                                  const next = [...prev]
                                  ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                                  return next
                                })
                              }
                              className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-50"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => setCandidates((prev) => prev.filter((_, i) => i !== idx))}
                              className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-50"
                            >
                              削除
                            </button>
                          </div>
                        </motion.div>
                      ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Bundle Toggle */}
          <div className="bg-gradient-to-br from-[#2563EB] to-blue-700 rounded-2xl sm:rounded-[32px] p-6 sm:p-8 text-white shadow-2xl shadow-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black leading-tight">セット作成（画像・サムネ込み）</h3>
                <p className="text-blue-100 text-[10px] sm:text-xs font-bold opacity-80 mt-1">記事内の図解とアイキャッチも全自動で作成します</p>
              </div>
            </div>
            <div className="sm:scale-125 self-end sm:self-auto">
              <Toggle checked={autoBundle} onChange={setAutoBundle} label="" />
            </div>
          </div>

          {/* Advanced Section */}
          <div id="advanced-section" className="space-y-4 scroll-mt-4">
            <button
              onClick={() => {
                const next = !showAdvanced
                setShowAdvanced(next)
                // 開く時はスムーズスクロール
                if (next) {
                  setTimeout(() => {
                    const el = document.getElementById('advanced-section')
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }
              }}
              className="w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-gray-200 text-gray-400 text-xs sm:text-sm font-black flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
            >
              <Settings2 className="w-4 h-4" />
              {showAdvanced ? '詳細設定を隠す' : 'ターゲット・参考URL・LLMO設定（詳細）'}
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-6 animate-fade-in-up">
                <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase">想定ターゲット</label>
                      <button
                        onClick={predictFromTitle}
                        disabled={predicting || !title.trim()}
                        className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {predicting ? '推定中...' : 'AI推定'}
                      </button>
                    </div>
                    <textarea
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      placeholder="誰に向けて書く記事ですか？"
                    />
                  </div>
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase">検索意図・ニーズ</label>
                      <button
                        onClick={predictFromTitle}
                        disabled={predicting || !title.trim()}
                        className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {predicting ? '推定中...' : 'AI推定'}
                      </button>
                    </div>
                    <textarea
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                      value={searchIntent}
                      onChange={(e) => setSearchIntent(e.target.value)}
                      placeholder="読者は何を知りたいですか？"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase">
                      一次情報（経験・訴求ポイント）※最重要
                    </label>
                    <button
                      onClick={predictFromTitle}
                      disabled={predicting || !title.trim()}
                      className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {predicting ? '推定中...' : 'AI推定'}
                    </button>
                  </div>
                  <textarea
                    className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[120px] focus:outline-none focus:border-blue-500"
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                    placeholder="例：実体験、現場の失敗談、数字、独自の主張、強い言い切り、具体例、読者に必ず伝えたいこと…"
                  />
                  <p className="mt-2 text-[10px] font-bold text-gray-400">
                    ✨ ここに一次情報を入れるほど、独自性と説得力が高まり、実務で使いやすい記事に仕上がります
                  </p>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8">
                  <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> LLMO（AI最適化）要素
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {Object.entries(llmo).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <div className="min-w-0 pr-2">
                          <span className="block text-[10px] font-black text-gray-800">
                            {(LLMO_LABELS[key]?.label || key)}
                          </span>
                          <span className="block text-[9px] font-bold text-gray-400 mt-0.5 line-clamp-2">
                            {LLMO_LABELS[key]?.desc || 'AI最適化の補助要素です'}
                          </span>
                        </div>
                        <Toggle checked={val} onChange={(v) => setLlmo(prev => ({ ...prev, [key]: v }))} label="" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8">
                  <label className="block text-sm font-black text-gray-900 mb-4">参考URL（競合サイトなど）</label>
                  <textarea
                    className="w-full p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50 text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                    value={referenceUrls}
                    onChange={(e) => setReferenceUrls(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-8 border-t border-gray-100 flex flex-col gap-4">
            <AiThinkingStrip
              show={loading}
              compact
              title="AIがSEO/LLMO対策を実行中…"
              subtitle={mode === 'comparison_research' ? '比較候補の調査 → 構造化 → 記事生成 を進めています' : '検索意図 → 構造化 → 網羅性 → 読みやすさ の順で最適化しています'}
              tags={['SEO', 'LLMO', '構造化', '網羅性', '読みやすさ']}
              steps={mode === 'comparison_research' ? ['比較候補を調査', '比較軸を整理', '結論/FAQを整備', '記事を生成'] : ['検索意図を推定', '見出しを設計', '本文を生成', '整合性を調整']}
            />

            <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
            <Button variant="ghost" onClick={saveDraft} className="w-full sm:w-auto text-gray-400 font-black order-2 sm:order-1">ドラフト保存</Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={loading || !canSubmit}
              className="w-full sm:w-auto px-12 h-14 sm:h-16 rounded-xl sm:rounded-2xl bg-[#2563EB] text-white font-black text-lg sm:text-xl shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:translate-y-[-2px] transition-all disabled:opacity-50 order-1 sm:order-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === 'comparison_research' ? '調査を開始中...' : '生成を開始中...'}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  {mode === 'comparison_research' ? '比較記事を作成（調査開始）' : '記事を生成する'}
                  <ArrowRight className="w-6 h-6" />
                </div>
              )}
            </Button>
            </div>
          </div>
        </motion.div>
    </main>
  )
}
