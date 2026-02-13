'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Sparkles,
  Image as ImageIcon,
  FileText,
  BarChart3,
  Download,
  Clipboard,
  ChevronRight,
  ChevronDown,
  X,
  Target,
  Check,
  AlertTriangle,
} from 'lucide-react'

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
  const [portraitError, setPortraitError] = useState('')
  const [bannerError, setBannerError] = useState('')
  const portraitAutoTriggered = useRef(false)

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

  // ペルソナ生成後にポートレートを自動生成
  useEffect(() => {
    if (generatedData?.persona && !portraitImage && !portraitLoading && !portraitAutoTriggered.current) {
      portraitAutoTriggered.current = true
      // 少し遅延させてUI描画を先に完了させる
      const timer = setTimeout(() => {
        handleGeneratePortrait()
      }, 500)
      return () => clearTimeout(timer)
    }
    // generatedDataがリセットされたらフラグもリセット
    if (!generatedData) {
      portraitAutoTriggered.current = false
    }
  }, [generatedData, portraitImage, portraitLoading])

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setPortraitError('')
    setBannerError('')
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
        throw new Error('ペルソナデータの取得に失敗しました。もう一度お試しください。')
      }

      setGeneratedData(data.data)

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
    }
  }

  const handleGeneratePortrait = async () => {
    if (!generatedData?.persona) return

    setPortraitLoading(true)
    setPortraitError('')
    try {
      const res = await fetch('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: generatedData.persona }),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data) {
        const msg = data?.error || 'ポートレート生成に失敗しました。もう一度お試しください。'
        throw new Error(msg)
      }

      if (data.success && data.image) {
        setPortraitImage(data.image)
        const stored = JSON.parse(localStorage.getItem('doya_persona_last') || '{}')
        stored.portrait = data.image
        localStorage.setItem('doya_persona_last', JSON.stringify(stored))
      } else {
        throw new Error(data.error || 'ポートレート画像の取得に失敗しました')
      }
    } catch (e) {
      setPortraitError(e instanceof Error ? e.message : 'ポートレート生成エラーが発生しました')
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerateBanner = async () => {
    if (!generatedData?.persona || !selectedCatchphrase) {
      setBannerError('キャッチコピーを選択してください')
      return
    }

    setBannerLoading(true)
    setBannerError('')
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

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data) {
        const msg = data?.error || 'バナー生成に失敗しました。もう一度お試しください。'
        throw new Error(msg)
      }

      if (data.success && data.image) {
        setBannerImage(data.image)
      } else {
        throw new Error(data.error || 'バナー画像の取得に失敗しました')
      }
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'バナー生成エラーが発生しました')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-white mb-1 flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            ドヤペルソナAI
          </h1>
          <p className="text-slate-400 text-sm">URLからマーケティングペルソナを自動生成</p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6">
          {/* URL Input - Primary */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-white mb-2">
              サイトURL <span className="text-purple-400">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-base"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4"
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      サービス名（任意）
                    </label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: ドヤマーケ"
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      追加情報（任意）
                    </label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="ターゲット層や商品の特徴など、補足情報があれば入力してください"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
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
            <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {generatedData && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
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
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Persona Tab — 日本式履歴書スタイル */}
            {activeTab === 'persona' && generatedData.persona && (
              <div className="bg-white rounded-lg shadow-2xl overflow-hidden max-w-4xl mx-auto text-gray-900" style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}>
                {/* ===== 上部: タイトル + 日付 ===== */}
                <div className="px-6 pt-5 pb-3 flex items-end justify-between">
                  <h2 className="text-2xl font-bold tracking-widest">ペルソナ履歴書</h2>
                  <p className="text-xs text-gray-500">{new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在</p>
                </div>

                {/* ===== メイン: 名前 + 基本情報 + 写真 ===== */}
                <div className="mx-6 border border-gray-400">
                  {/* 名前行 + 写真 */}
                  <div className="flex">
                    {/* 左: 名前 + 基本情報テーブル */}
                    <div className="flex-1 min-w-0">
                      {/* ふりがな + 氏名 */}
                      <div className="border-b border-gray-300 px-3 py-1">
                        <p className="text-[10px] text-gray-400">ふりがな</p>
                      </div>
                      <div className="border-b border-gray-400 px-3 py-2">
                        <p className="text-xl font-bold">{generatedData.persona.name}</p>
                      </div>
                      {/* 生年月日・性別 */}
                      <div className="border-b border-gray-400 px-3 py-2 flex items-center gap-4 text-sm">
                        <span>{generatedData.persona.age}歳</span>
                        <span className="text-gray-300">|</span>
                        <span>{generatedData.persona.gender}</span>
                      </div>
                      {/* 居住地 */}
                      <div className="border-b border-gray-300 px-3 py-1">
                        <p className="text-[10px] text-gray-400">現住所</p>
                      </div>
                      <div className="border-b border-gray-400 px-3 py-2 text-sm">
                        {generatedData.persona.location}
                      </div>
                      {/* 職業 */}
                      <div className="border-b border-gray-300 px-3 py-1">
                        <p className="text-[10px] text-gray-400">職業</p>
                      </div>
                      <div className="px-3 py-2 text-sm">
                        {generatedData.persona.occupation}
                      </div>
                    </div>
                    {/* 右: 写真欄 */}
                    <div className="w-[130px] flex-shrink-0 border-l border-gray-400 flex flex-col items-center justify-center p-2 bg-gray-50">
                      <div className="w-[105px] h-[140px] border border-gray-300 bg-white overflow-hidden flex items-center justify-center">
                        {portraitImage ? (
                          <img src={portraitImage} alt="Persona" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-gray-300 text-xs leading-relaxed">
                            <p className="text-3xl mb-1">👤</p>
                            <p>写真</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        {!portraitImage ? (
                          <button
                            onClick={handleGeneratePortrait}
                            disabled={portraitLoading}
                            className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {portraitLoading ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                生成中
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-2.5 h-2.5" />
                                写真を生成
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => downloadImage(portraitImage, `persona-${generatedData.persona.name}.png`)}
                            className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 inline-flex items-center gap-1"
                          >
                            <Download className="w-2.5 h-2.5" />
                            保存
                          </button>
                        )}
                      </div>
                      {portraitError && (
                        <p className="mt-1 text-red-500 text-[10px] text-center">{portraitError}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ===== 基本属性テーブル ===== */}
                <div className="mx-6 mt-4 border border-gray-400">
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap">年収</td>
                        <td className="border border-gray-300 px-3 py-2">{generatedData.persona.income}</td>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap">家族構成</td>
                        <td className="border border-gray-300 px-3 py-2">{generatedData.persona.familyStructure}</td>
                      </tr>
                      <tr>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">ライフスタイル</td>
                        <td colSpan={3} className="border border-gray-300 px-3 py-2">{generatedData.persona.lifestyle}</td>
                      </tr>
                      <tr>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">一日の過ごし方</td>
                        <td colSpan={3} className="border border-gray-300 px-3 py-2">{generatedData.persona.dayInLife}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ===== 座右の銘（quote） ===== */}
                {generatedData.persona.quote && (
                  <div className="mx-6 mt-4 border border-gray-400">
                    <div className="flex">
                      <div className="bg-gray-100 border-r border-gray-300 px-3 py-2 font-bold text-xs w-[100px] flex items-center justify-center whitespace-nowrap">座右の銘</div>
                      <div className="px-3 py-2 text-sm italic flex-1">&ldquo;{generatedData.persona.quote}&rdquo;</div>
                    </div>
                  </div>
                )}

                {/* ===== 課題・悩み / 目標・願望 ===== */}
                <div className="mx-6 mt-4 border border-gray-400">
                  <div className="bg-gray-100 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center">課題・悩み</div>
                  <div className="px-3 py-2">
                    {generatedData.persona.challenges?.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-200 last:border-b-0">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mx-6 mt-4 border border-gray-400">
                  <div className="bg-gray-100 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center">目標・願望</div>
                  <div className="px-3 py-2">
                    {generatedData.persona.goals?.map((g, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-200 last:border-b-0">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== 購買動機 / 懸念・反論 ===== */}
                {generatedData.persona.purchaseMotivation?.length > 0 && (
                  <div className="mx-6 mt-4 border border-gray-400">
                    <div className="bg-gray-100 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center">購買動機</div>
                    <div className="px-3 py-2">
                      {generatedData.persona.purchaseMotivation.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-200 last:border-b-0">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generatedData.persona.objections?.length > 0 && (
                  <div className="mx-6 mt-4 border border-gray-400">
                    <div className="bg-gray-100 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center">懸念・反論</div>
                    <div className="px-3 py-2">
                      {generatedData.persona.objections.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-200 last:border-b-0">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                          <span>{o}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== メディア利用 / 性格特性 ===== */}
                <div className="mx-6 mt-4 border border-gray-400">
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap align-top">メディア利用</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {generatedData.persona.mediaUsage?.map((m, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap align-top">性格特性</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {generatedData.persona.personalityTraits?.map((t, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 余白 */}
                <div className="h-6" />
              </div>
            )}

            {/* Creatives Tab */}
            {activeTab === 'creatives' && generatedData.creatives && (
              <div className="space-y-6">
                {/* Catchphrases with Banner Generation */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    ✨ キャッチコピー候補
                    <span className="text-xs text-slate-500 font-normal">（クリックで選択→バナー生成）</span>
                  </h3>
                  <div className="space-y-2 mb-5">
                    {generatedData.creatives.catchphrases?.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCatchphrase(c)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                          selectedCatchphrase === c
                            ? 'bg-purple-900/30 border-purple-500 text-purple-300'
                            : 'bg-slate-800/50 border-slate-700 text-white hover:border-slate-600'
                        }`}
                      >
                        <span className="font-medium text-sm">{c}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `catch-${i}`) }}
                            className="p-1 hover:bg-slate-700 rounded"
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
                    <div className="border-t border-slate-700 pt-5">
                      <h4 className="text-sm font-bold text-white mb-3">🎨 バナー画像生成</h4>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <select
                          value={selectedBannerSize}
                          onChange={(e) => setSelectedBannerSize(e.target.value)}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
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

                      {bannerError && (
                        <div className="mt-3 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{bannerError}</span>
                        </div>
                      )}

                      {bannerImage && (
                        <div className="mt-4">
                          <img src={bannerImage} alt="Generated Banner" className="max-w-full h-auto rounded-lg border border-slate-700" />
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
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-base font-bold text-white mb-4">📄 LP構成案</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 border-purple-500">
                      <p className="text-xs text-purple-400 font-bold mb-1">ヒーローセクション</p>
                      <p className="text-white text-sm">{generatedData.creatives.lpStructure?.hero}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 border-red-500">
                      <p className="text-xs text-red-400 font-bold mb-1">課題提起</p>
                      <p className="text-white text-sm">{generatedData.creatives.lpStructure?.problem}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 border-green-500">
                      <p className="text-xs text-green-400 font-bold mb-1">解決策</p>
                      <p className="text-white text-sm">{generatedData.creatives.lpStructure?.solution}</p>
                    </div>
                    {generatedData.creatives.lpStructure?.benefits && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-blue-400 font-bold mb-2">ベネフィット</p>
                        <ul className="space-y-1">
                          {generatedData.creatives.lpStructure.benefits.map((b, i) => (
                            <li key={i} className="text-slate-300 text-sm">✓ {b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.creatives.lpStructure?.cta && (
                      <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg text-center">
                        <p className="text-xs text-slate-400 mb-1">CTA</p>
                        <p className="text-lg font-bold text-white">{generatedData.creatives.lpStructure.cta}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ad Copy */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
                    <h3 className="text-base font-bold text-white mb-3">🔍 Google検索広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.google?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-800/50 rounded-lg group">
                          <p className="text-slate-300 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `google-${i}`)}
                            className="mt-2 text-xs text-slate-500 hover:text-purple-400 flex items-center gap-1"
                          >
                            {copied === `google-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                            コピー
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
                    <h3 className="text-base font-bold text-white mb-3">📱 Meta/SNS広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.meta?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                          <p className="text-slate-300 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `meta-${i}`)}
                            className="mt-2 text-xs text-slate-500 hover:text-purple-400 flex items-center gap-1"
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
                  <div key={i} className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
                    <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      {category.category}
                    </h3>
                    <div className="space-y-2">
                      {category.items?.map((item, j) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              item.priority === 'high'
                                ? 'bg-red-900/50 text-red-400'
                                : item.priority === 'medium'
                                ? 'bg-yellow-900/50 text-yellow-400'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span className="text-slate-300 text-sm">{item.task}</span>
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
