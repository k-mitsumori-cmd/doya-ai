'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Image as ImageIcon,
  FileText,
  BarChart3,
  Download,
  Clipboard,
  ChevronRight,
  ChevronDown,
  Target,
  Check,
} from 'lucide-react'

// 演出用：候補ペルソナ（ダミー）
const LOADING_CANDIDATES = [
  { name: '佐藤 まどか', age: 29, role: 'EC運用担当', note: '価格比較→即決タイプ' },
  { name: '鈴木 恒一', age: 41, role: '情報システム部', note: '稟議・セキュリティ重視' },
  { name: '高橋 さくら', age: 33, role: 'マーケ責任者', note: 'CVR改善・運用重視' },
  { name: '田中 健', age: 27, role: '個人事業主', note: 'スピード・コスパ重視' },
  { name: '伊藤 恒一', age: 38, role: '営業Mgr', note: '導入事例・実績で判断' },
  { name: '渡辺 由衣', age: 45, role: '人事責任者', note: '採用・ブランド重視' },
] as const

function formatJpDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}年${mm}月${dd}日`
}

// バナーサイズオプション
const BANNER_SIZES = [
  { key: 'google-responsive', label: 'Google レスポンシブ (1200×628)', width: 1200, height: 628 },
  { key: 'google-square', label: 'Google スクエア (1200×1200)', width: 1200, height: 1200 },
  { key: 'meta-feed', label: 'Meta フィード (1080×1080)', width: 1080, height: 1080 },
  { key: 'meta-story', label: 'Meta ストーリー (1080×1920)', width: 1080, height: 1920 },
  { key: 'twitter', label: 'Twitter/X (1200×675)', width: 1200, height: 675 },
  { key: 'youtube', label: 'YouTube サムネイル (1280×720)', width: 1280, height: 720 },
]

interface PersonaData {
  name: string
  age: number
  gender: string
  occupation: string
  income: string
  location: string
  familyStructure: string
  lifestyle: string
  challenges: string[]
  goals: string[]
  mediaUsage: string[]
  purchaseMotivation: string[]
  objections: string[]
  personalityTraits: string[]
  dayInLife: string
  quote: string
}

interface CreativesData {
  catchphrases: string[]
  lpStructure: {
    hero: string
    problem: string
    solution: string
    benefits: string[]
    cta: string
  }
  adCopy: {
    google: string[]
    meta: string[]
  }
  emailDraft: {
    subject: string
    body: string
  }
}

interface GeneratedData {
  persona: PersonaData
  creatives: CreativesData
  marketingChecklist: { category: string; items: { task: string; priority: string }[] }[]
}

export default function PersonaPage() {
  const [url, setUrl] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [bannerLoading, setBannerLoading] = useState(false)
  const [selectedBannerSize, setSelectedBannerSize] = useState(BANNER_SIZES[0].key)
  const [selectedCatchphrase, setSelectedCatchphrase] = useState('')
  const [activeTab, setActiveTab] = useState<'persona' | 'creatives' | 'checklist'>('persona')
  const [copied, setCopied] = useState<string | null>(null)
  const [stageText, setStageText] = useState<string>('サイトを解析しています…')
  const [stageIdx, setStageIdx] = useState<number>(0)
  const [showFlash, setShowFlash] = useState(false)

  // ローカルストレージから履歴読み込み
  useEffect(() => {
    const stored = localStorage.getItem('doya_persona_last')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.data) {
          setGeneratedData(parsed.data)
          setPortraitImage(parsed.portrait || null)
        }
      } catch {}
    }
  }, [])

  // 生成中のド派手演出（テキスト/候補スライド）
  useEffect(() => {
    if (!loading) return
    setShowFlash(true)
    setStageIdx(0)
    const stages = [
      'サイトを解析しています…',
      'ユーザーの悩みを抽出しています…',
      '意思決定パターンを推定中…',
      '競合と差別化ポイントを特定中…',
      'ペルソナ候補をスキャン中…',
      '売れるコピーの筋を作っています…',
    ]
    const t = window.setInterval(() => {
      setStageIdx((v) => (v + 1) % stages.length)
      setStageText((prev) => stages[(stages.indexOf(prev) + 1 + stages.length) % stages.length] || stages[0])
    }, 850)
    return () => window.clearInterval(t)
  }, [loading])

  const generatePortraitForPersona = async (persona: any) => {
    setPortraitLoading(true)
    try {
      const res = await fetch('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      if (!res.ok || !data?.success || !data?.image) {
        throw new Error((data && (data.error || data.message)) || 'ポートレート生成に失敗しました')
      }
      setPortraitImage(data.image)

      // ローカルストレージ更新（最新）
      const stored = JSON.parse(localStorage.getItem('doya_persona_last') || '{}')
      stored.portrait = data.image
      localStorage.setItem('doya_persona_last', JSON.stringify(stored))

      // 履歴の先頭にもportraitを反映（存在すれば）
      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      if (Array.isArray(history) && history.length > 0) {
        history[0] = { ...history[0], portrait: data.image }
        localStorage.setItem('doya_persona_history', JSON.stringify(history))
      }
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setGeneratedData(null)
    setPortraitImage(null)
    setBannerImage(null)

    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, serviceName, additionalInfo }),
      })

      // NOTE: APIがHTMLや途中切れJSONを返した場合でも、ここで落とさずにメッセージ化する
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (raw && raw.slice(0, 200)) ||
          'ペルソナ生成に失敗しました'
        throw new Error(msg)
      }

      if (!data?.data || !data?.data?.persona) {
        throw new Error('ペルソナデータの取得に失敗しました')
      }

      setGeneratedData(data.data)
      // 生成と同時にポートレートも自動生成
      try {
        await generatePortraitForPersona(data.data.persona)
      } catch (e) {
        // ポートレート失敗は致命ではない（UI上は再生成ボタンで復旧できる）
        setError(e instanceof Error ? e.message : 'ポートレート生成エラー')
      }

      // ローカルストレージに保存
      localStorage.setItem('doya_persona_last', JSON.stringify({ data: data.data, url, timestamp: Date.now() }))

      // 履歴に追加
      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      history.unshift({ data: data.data, url, timestamp: Date.now() })
      localStorage.setItem('doya_persona_history', JSON.stringify(history.slice(0, 20)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
      setTimeout(() => setShowFlash(false), 250)
    }
  }

  const handleGeneratePortrait = async () => {
    if (!generatedData?.persona) return

    try {
      await generatePortraitForPersona(generatedData.persona)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ポートレート生成エラー')
    }
  }

  const handleGenerateBanner = async () => {
    if (!generatedData?.persona || !selectedCatchphrase) {
      setError('キャッチコピーを選択してください')
      return
    }

    setBannerLoading(true)
    try {
      const res = await fetch('/api/persona/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: generatedData.persona,
          serviceName,
          catchphrase: selectedCatchphrase,
          sizeKey: selectedBannerSize,
        }),
      })

      const data = await res.json()
      if (data.success && data.image) {
        setBannerImage(data.image)
      } else {
        throw new Error(data.error || 'バナー生成失敗')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'バナー生成エラー')
    } finally {
      setBannerLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }

  const resumeIssueDate = useMemo(() => formatJpDate(new Date()), [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ド派手：生成中オーバーレイ */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-purple-500/30 blur-3xl" />
              <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-pink-500/30 blur-3xl" />
            </div>

            <div className="relative h-full flex flex-col items-center justify-center px-4">
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-3xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-black tracking-widest">PERSONA SCAN</span>
                  </div>
                  <div className="text-white/80 text-xs font-bold">いま、めちゃくちゃペルソナを検索しています…</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-lg leading-tight">ペルソナ生成中</p>
                      <p className="text-white/70 text-sm font-bold truncate">{stageText}</p>
                    </div>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>

                  {/* progress */}
                  <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-2 bg-gradient-to-r from-purple-400 to-pink-400"
                      initial={{ width: '12%' }}
                      animate={{ width: ['12%', '92%', '28%', '100%'] }}
                      transition={{ duration: 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                    />
                  </div>

                  {/* sliding candidates */}
                  <div className="mt-5 overflow-hidden">
                    <motion.div
                      className="flex gap-3"
                      animate={{ x: ['0%', '-50%'] }}
                      transition={{ duration: 6.5, repeat: Infinity, ease: 'linear' }}
                    >
                      {[...LOADING_CANDIDATES, ...LOADING_CANDIDATES].map((c, idx) => (
                        <div
                          key={`${c.name}-${idx}`}
                          className="w-[240px] flex-shrink-0 rounded-xl border border-white/15 bg-white/10 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/80 font-black">
                              {c.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-black truncate">{c.name}</p>
                              <p className="text-white/70 text-xs font-bold">{c.age}歳 / {c.role}</p>
                              <p className="text-white/60 text-[11px] font-bold mt-1 truncate">「{c.note}」</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  {/* popup-like hints */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      'LPの勝ち筋を推定中…',
                      '広告クリック心理を逆算中…',
                      '刺さる言葉のトーンを調整中…',
                    ].map((t, i) => (
                      <motion.div
                        key={t}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: [0.4, 1, 0.6], y: [6, 0, 4] }}
                        transition={{ duration: 1.8, delay: i * 0.2, repeat: Infinity, repeatType: 'mirror' }}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80 text-xs font-bold"
                      >
                        {t}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1 flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            ドヤペルソナAI
          </h1>
          <p className="text-slate-600 text-sm">URLからマーケティングペルソナを自動生成</p>
        </div>

        {/* Input Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
          {/* URL Input - Primary */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-900 mb-2">
              サイトURL <span className="text-purple-400">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-base"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors mb-4"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            詳細設定（任意）
          </button>

          {/* Advanced Settings */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      サービス名（任意）
                    </label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: ドヤマーケ"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      追加情報（任意）
                    </label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="ターゲット層や商品の特徴など、補足情報があれば入力してください"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                ペルソナを生成
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {generatedData && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              {[
                { key: 'persona', label: 'ペルソナ', icon: Target },
                { key: 'creatives', label: 'クリエイティブ', icon: Sparkles },
                { key: 'checklist', label: 'チェックリスト', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                      activeTab === tab.key
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Persona Tab */}
            {activeTab === 'persona' && generatedData.persona && (
              <div className="mx-auto max-w-5xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-slate-700 text-sm font-black">履歴書（ペルソナ）</div>
                  <div className="text-slate-500 text-xs font-bold">作成日：{resumeIssueDate}</div>
                </div>

                {/* 履歴書風：A4っぽい枠線 */}
                <div className="bg-white border-2 border-slate-800">
                  {/* Header row */}
                  <div className="grid grid-cols-12 border-b border-slate-800">
                    <div className="col-span-9 p-4 border-r border-slate-800">
                      <div className="text-sm font-black text-slate-900">ふりがな（仮）</div>
                      <div className="mt-1 text-2xl font-black text-slate-900 tracking-wide">{generatedData.persona.name}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">年齢</div>
                          <div className="text-slate-900 font-black">{generatedData.persona.age}歳</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">性別</div>
                          <div className="text-slate-900 font-black">{generatedData.persona.gender}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">職業</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.occupation}</div>
                        </div>
                      </div>
                      {generatedData.persona.quote ? (
                        <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">本人の一言（口癖）</div>
                          <div className="text-slate-900 font-bold">「{generatedData.persona.quote}」</div>
                        </div>
                      ) : null}
                    </div>

                    {/* Photo cell */}
                    <div className="col-span-3 p-4">
                      <div className="text-[10px] font-black text-slate-500">写真（AI生成）</div>
                      <div className="mt-2 aspect-[3/4] border-2 border-slate-800 bg-white overflow-hidden flex items-center justify-center">
                        {portraitImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={portraitImage} alt="portrait" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-400 text-xs font-bold">生成中…</div>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleGeneratePortrait}
                          disabled={portraitLoading}
                          className="flex-1 h-9 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-800 disabled:opacity-50"
                        >
                          {portraitLoading ? '生成中…' : '再生成'}
                        </button>
                        {portraitImage ? (
                          <button
                            onClick={() => downloadImage(portraitImage, `persona-${generatedData.persona.name}.png`)}
                            className="flex-1 h-9 rounded-lg bg-purple-600 text-white text-xs font-black hover:bg-purple-500"
                          >
                            保存
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 h-9 rounded-lg bg-slate-200 text-slate-500 text-xs font-black"
                          >
                            保存
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body grid: resume-like rows */}
                  <div className="grid grid-cols-12">
                    {/* left column */}
                    <div className="col-span-6 border-r border-slate-800">
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">現住所</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.location}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">家族構成</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.familyStructure}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">年収</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.income}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">生活</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">{generatedData.persona.lifestyle}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">一日</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">{generatedData.persona.dayInLife}</div>
                      </div>
                    </div>

                    {/* right column */}
                    <div className="col-span-6">
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">性格</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">
                          {(generatedData.persona.personalityTraits || []).join(' / ') || '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">メディア</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">
                          {(generatedData.persona.mediaUsage || []).join(' / ') || '—'}
                        </div>
                      </div>

                      <div className="p-4 border-b border-slate-200">
                        <div className="text-xs font-black text-slate-700 mb-2">課題・悩み（重要）</div>
                        <div className="grid gap-2">
                          {(generatedData.persona.challenges || []).slice(0, 6).map((c, i) => (
                            <div key={i} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="text-xs font-black text-slate-700 mb-2">目標・願望（刺さる未来）</div>
                        <div className="grid gap-2">
                          {(generatedData.persona.goals || []).slice(0, 6).map((g, i) => (
                            <div key={i} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                              {g}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Creatives Tab */}
            {activeTab === 'creatives' && generatedData.creatives && (
              <div className="space-y-6">
                {/* Catchphrases with Banner Generation */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    ✨ キャッチコピー候補
                    <span className="text-xs text-slate-500 font-normal">（クリックで選択 → バナー生成）</span>
                  </h3>
                  <div className="space-y-2 mb-5">
                    {generatedData.creatives.catchphrases?.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedCatchphrase(c)
                          // クリック→即バナー生成（要望）
                          if (!bannerLoading) {
                            // 選択反映後に実行
                            setTimeout(() => {
                              // selectedCatchphrase はstateなので、cを直接使う
                              void (async () => {
                                setBannerLoading(true)
                                try {
                                  const res = await fetch('/api/persona/banner', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      persona: generatedData.persona,
                                      serviceName,
                                      catchphrase: c,
                                      sizeKey: selectedBannerSize,
                                    }),
                                  })
                                  const raw = await res.text()
                                  let data: any = null
                                  try {
                                    data = raw ? JSON.parse(raw) : null
                                  } catch {
                                    data = null
                                  }
                                  if (!res.ok || !data?.success || !data?.image) {
                                    throw new Error((data && (data.error || data.message)) || 'バナー生成失敗')
                                  }
                                  setBannerImage(data.image)
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : 'バナー生成エラー')
                                } finally {
                                  setBannerLoading(false)
                                }
                              })()
                            }, 0)
                          }
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                          selectedCatchphrase === c
                            ? 'bg-purple-50 border-purple-200 text-purple-800'
                            : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-medium text-sm">{c}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `catch-${i}`) }}
                            className="p-1 hover:bg-slate-100 rounded"
                            title="コピー"
                          >
                            {copied === `catch-${i}` ? <Check className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                          </button>
                          {selectedCatchphrase === c && <ChevronRight className="w-4 h-4 text-purple-400" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedCatchphrase && (
                    <div className="border-t border-slate-200 pt-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3">🎨 バナー画像生成</h4>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <select
                          value={selectedBannerSize}
                          onChange={(e) => setSelectedBannerSize(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        >
                          {BANNER_SIZES.map((size) => (
                            <option key={size.key} value={size.key}>{size.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleGenerateBanner}
                          disabled={bannerLoading}
                          className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center gap-2"
                        >
                          {bannerLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4" />
                              バナー生成
                            </>
                          )}
                        </button>
                      </div>

                      {bannerImage && (
                        <div className="mt-4">
                          <img src={bannerImage} alt="Generated Banner" className="max-w-full h-auto rounded-lg border border-slate-200" />
                          <button
                            onClick={() => downloadImage(bannerImage, `banner-${selectedBannerSize}.png`)}
                            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-2 text-sm font-bold"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LP Structure */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">📄 LP構成案</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-purple-500">
                      <p className="text-xs text-purple-400 font-bold mb-1">ヒーローセクション</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.hero}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-red-500">
                      <p className="text-xs text-red-400 font-bold mb-1">課題提起</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.problem}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-green-500">
                      <p className="text-xs text-green-400 font-bold mb-1">解決策</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.solution}</p>
                    </div>
                    {generatedData.creatives.lpStructure?.benefits && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-blue-700 font-bold mb-2">ベネフィット</p>
                        <ul className="space-y-1">
                          {generatedData.creatives.lpStructure.benefits.map((b, i) => (
                            <li key={i} className="text-slate-700 text-sm">✓ {b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.creatives.lpStructure?.cta && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-center border border-purple-100">
                        <p className="text-xs text-slate-500 mb-1">CTA</p>
                        <p className="text-lg font-bold text-slate-900">{generatedData.creatives.lpStructure.cta}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ad Copy */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-3">🔍 Google検索広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.google?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                          <p className="text-slate-700 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `google-${i}`)}
                            className="mt-2 text-xs text-slate-500 hover:text-purple-700 flex items-center gap-1"
                          >
                            {copied === `google-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                            コピー
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-3">📱 Meta/SNS広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.meta?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p className="text-slate-700 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `meta-${i}`)}
                            className="mt-2 text-xs text-slate-500 hover:text-purple-700 flex items-center gap-1"
                          >
                            {copied === `meta-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                            コピー
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && generatedData.marketingChecklist && (
              <div className="space-y-4">
                {generatedData.marketingChecklist.map((category, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      {category.category}
                    </h3>
                    <div className="space-y-2">
                      {category.items?.map((item, j) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              item.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : item.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span className="text-slate-700 text-sm">{item.task}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
