'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, Palette, Zap, Check, ChevronRight, Eye, Layers, FileText, Image, Loader2 } from 'lucide-react'

type Mood = 'japanese_modern' | 'wa_tech' | 'minimal' | 'bold' | 'startup'
type Industry = 'saas' | 'hr' | 'ai' | 'marketing' | 'fintech' | 'other'

type PreviewPattern = {
  id: 'A' | 'B' | 'C'
  title: string
  description: string
  reasons: string
  oneLiner: string
  logos: Array<{ layout: 'horizontal' | 'square'; mode: 'default' | 'dark' | 'mono' | 'invert'; svg: string }>
}

const moodOptions: Array<{ value: Mood; label: string; icon: string; desc: string }> = [
  { value: 'japanese_modern', label: '日本的モダン', icon: '🎌', desc: '余白と信頼感を重視' },
  { value: 'wa_tech', label: '和×テック', icon: '⛩️', desc: '伝統と革新の融合' },
  { value: 'minimal', label: 'ミニマル', icon: '◯', desc: '究極にシンプル' },
  { value: 'bold', label: '力強い', icon: '💪', desc: 'インパクト重視' },
  { value: 'startup', label: 'スタートアップ', icon: '🚀', desc: 'フレッシュ＆動的' },
]

const industryOptions: Array<{ value: Industry; label: string; color: string }> = [
  { value: 'saas', label: 'SaaS', color: 'from-blue-500 to-cyan-500' },
  { value: 'hr', label: 'HR', color: 'from-emerald-500 to-teal-500' },
  { value: 'ai', label: 'AI', color: 'from-violet-500 to-purple-500' },
  { value: 'marketing', label: 'マーケ', color: 'from-pink-500 to-rose-500' },
  { value: 'fintech', label: 'Fintech', color: 'from-amber-500 to-orange-500' },
  { value: 'other', label: 'Other', color: 'from-slate-500 to-gray-500' },
]

const features = [
  { icon: Layers, text: 'A/B/C 3パターン同時生成' },
  { icon: Palette, text: 'カラーパレット自動生成' },
  { icon: FileText, text: 'ガイドライン & 生成理由' },
  { icon: Download, text: 'SVG/PNG/JPEG 一括DL' },
]

export default function DoyaLogoPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [mood, setMood] = useState<Mood>('japanese_modern')
  const [industry, setIndustry] = useState<Industry>('saas')
  const [mainColor, setMainColor] = useState('#1D4ED8')
  const [subColor, setSubColor] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patterns, setPatterns] = useState<PreviewPattern[] | null>(null)
  const [selectedPattern, setSelectedPattern] = useState<'A' | 'B' | 'C'>('A')
  const [previewMode, setPreviewMode] = useState<'default' | 'dark'>('default')

  // 参考バナー/イメージURL
  const [referenceImageUrl, setReferenceImageUrl] = useState('')

  const payload = useMemo(
    () => ({
      serviceName,
      serviceDescription,
      mood,
      industry,
      mainColor: mainColor || undefined,
      subColor: subColor || undefined,
      referenceImageUrl: referenceImageUrl || undefined,
    }),
    [serviceName, serviceDescription, mood, industry, mainColor, subColor, referenceImageUrl]
  )

  const canProceedStep1 = serviceName.trim().length >= 1
  const canProceedStep2 = serviceDescription.trim().length >= 1

  async function generateLogos() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, returnMode: 'json' }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || '生成に失敗しました')
      setPatterns(json.patterns as PreviewPattern[])
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  async function downloadZip() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, returnMode: 'zip' }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'ZIP生成に失敗しました')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${serviceName || 'logo'}-kit.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  const currentPattern = patterns?.find((p) => p.id === selectedPattern)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/10 rounded-full blur-[150px]" />
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ドヤロゴ</h1>
              <p className="text-xs text-white/50">DOYA LOGO</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/60">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <f.icon className="w-4 h-4" />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => s < step && setStep(s as 1 | 2 | 3)}
                disabled={s > step}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                  ${step >= s 
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30' 
                    : 'bg-white/5 text-white/30 border border-white/10'}
                  ${s < step ? 'cursor-pointer hover:scale-110' : ''}
                `}
              >
                {step > s ? <Check className="w-5 h-5" /> : s}
              </button>
              {s < 3 && (
                <div className={`w-16 h-0.5 ${step > s ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Service Name */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center"
            >
              <h2 className="text-4xl sm:text-5xl font-black mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                サービス名を入力
              </h2>
              <p className="text-white/50 mb-10">あなたのブランド名を教えてください</p>

              <div className="relative mb-8">
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="例：ドヤロゴ"
                  className="w-full px-8 py-6 text-2xl sm:text-3xl font-bold text-center bg-white/5 border-2 border-white/10 rounded-2xl outline-none focus:border-violet-500 transition-all placeholder:text-white/20"
                  autoFocus
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 blur-xl -z-10 opacity-0 transition-opacity peer-focus:opacity-100" />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className={`
                  inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition-all
                  ${canProceedStep1 
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 hover:scale-105 hover:shadow-xl hover:shadow-violet-500/40' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'}
                `}
              >
                次へ
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-black mb-3">
                  <span className="text-violet-400">{serviceName}</span> の詳細
                </h2>
                <p className="text-white/50">ロゴの雰囲気をカスタマイズ</p>
              </div>

              <div className="grid gap-8">
                {/* Service Description */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <label className="block text-sm font-semibold text-white/70 mb-3">サービス内容</label>
                  <textarea
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="例：サービス名と内容だけで、日本っぽくてイケてるロゴを自動生成"
                    rows={3}
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-violet-500 transition-all placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Mood Selection */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <label className="block text-sm font-semibold text-white/70 mb-4">ロゴの雰囲気</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {moodOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMood(opt.value)}
                        className={`
                          p-4 rounded-xl text-center transition-all border-2
                          ${mood === opt.value 
                            ? 'bg-violet-500/20 border-violet-500 shadow-lg shadow-violet-500/20' 
                            : 'bg-white/5 border-white/10 hover:border-white/20'}
                        `}
                      >
                        <div className="text-2xl mb-2">{opt.icon}</div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-white/40 mt-1">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Industry Selection */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <label className="block text-sm font-semibold text-white/70 mb-4">業界</label>
                  <div className="flex flex-wrap gap-3">
                    {industryOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setIndustry(opt.value)}
                        className={`
                          px-5 py-3 rounded-full font-semibold text-sm transition-all
                          ${industry === opt.value 
                            ? `bg-gradient-to-r ${opt.color} text-white shadow-lg` 
                            : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/20'}
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <label className="block text-sm font-semibold text-white/70 mb-3">メインカラー</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={mainColor}
                        onChange={(e) => setMainColor(e.target.value)}
                        className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={mainColor}
                        onChange={(e) => setMainColor(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-violet-500 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <label className="block text-sm font-semibold text-white/70 mb-3">サブカラー（任意）</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={subColor || '#06B6D4'}
                        onChange={(e) => setSubColor(e.target.value)}
                        className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={subColor}
                        onChange={(e) => setSubColor(e.target.value)}
                        placeholder="#06B6D4"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-violet-500 font-mono text-sm placeholder:text-white/20"
                      />
                    </div>
                  </div>
                </div>

                {/* URLからカラー抽出は廃止 */}

                {/* 参考バナー/イメージURL */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <Image className="w-4 h-4 text-fuchsia-400" />
                    <label className="text-sm font-semibold text-white/70">参考バナー/イメージURL（任意）</label>
                  </div>
                  <p className="text-xs text-white/40 mb-4">参考にしたいバナーやロゴの画像URLを入力すると、雰囲気を考慮して生成します</p>
                  <input
                    type="url"
                    value={referenceImageUrl}
                    onChange={(e) => setReferenceImageUrl(e.target.value)}
                    placeholder="https://example.com/banner.png"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-fuchsia-500 text-sm placeholder:text-white/20"
                  />
                  {referenceImageUrl && (
                    <div className="mt-4 flex items-center gap-3 p-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl">
                      <Check className="w-4 h-4 text-fuchsia-400" />
                      <span className="text-sm text-fuchsia-300">参考イメージを設定しました</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={generateLogos}
                  disabled={!canProceedStep2 || loading}
                  className={`
                    w-full py-5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3
                    ${canProceedStep2 && !loading
                      ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40' 
                      : 'bg-white/5 text-white/30 cursor-not-allowed'}
                  `}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ロゴを生成中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      ロゴを生成する
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Results */}
          {step === 3 && patterns && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-black mb-3">
                  <span className="text-violet-400">{serviceName}</span> のロゴ完成！
                </h2>
                <p className="text-white/50">3パターンから選んでダウンロード</p>
              </div>

              <div className="grid lg:grid-cols-[1fr,360px] gap-6">
                {/* Main Preview */}
                <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                  {/* Pattern Tabs */}
                  <div className="flex border-b border-white/10">
                    {patterns.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPattern(p.id)}
                        className={`
                          flex-1 px-6 py-4 font-semibold transition-all relative
                          ${selectedPattern === p.id ? 'text-white' : 'text-white/50 hover:text-white/70'}
                        `}
                      >
                        <span>Pattern {p.id}</span>
                        {selectedPattern === p.id && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Preview Area */}
                  <div className={`p-8 min-h-[300px] flex items-center justify-center transition-colors ${previewMode === 'dark' ? 'bg-[#0B0F1A]' : 'bg-white'}`}>
                    {currentPattern && (
                      <div 
                        className="w-full max-w-2xl [&_svg]:w-full [&_svg]:h-auto"
                        dangerouslySetInnerHTML={{ 
                          __html: currentPattern.logos.find(
                            (l) => l.layout === 'horizontal' && l.mode === (previewMode === 'dark' ? 'dark' : 'default')
                          )?.svg || '' 
                        }} 
                      />
                    )}
                  </div>

                  {/* Preview Controls */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewMode('default')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${previewMode === 'default' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:text-white'}`}
                      >
                        ライト
                      </button>
                      <button
                        onClick={() => setPreviewMode('dark')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${previewMode === 'dark' ? 'bg-white/90 text-black' : 'bg-white/10 text-white/70 hover:text-white'}`}
                      >
                        ダーク
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <Eye className="w-4 h-4" />
                      横長ロゴ
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Pattern Info */}
                  {currentPattern && (
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {currentPattern.id}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm leading-tight">{currentPattern.title}</h3>
                          <p className="text-xs text-white/50 mt-0.5 leading-snug">{currentPattern.description}</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {currentPattern.oneLiner}
                      </p>
                    </div>
                  )}

                  {/* Square Preview */}
                  {currentPattern && (
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <h4 className="text-sm font-semibold text-white/70 mb-3">アイコン版</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="aspect-square rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden">
                          <div 
                            className="w-full h-full [&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-full [&_svg]:max-h-full"
                            dangerouslySetInnerHTML={{ 
                              __html: currentPattern.logos.find(
                                (l) => l.layout === 'square' && l.mode === 'default'
                              )?.svg || '' 
                            }} 
                          />
                        </div>
                        <div className="aspect-square rounded-xl bg-[#0B0F1A] p-3 flex items-center justify-center overflow-hidden">
                          <div 
                            className="w-full h-full [&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-full [&_svg]:max-h-full"
                            dangerouslySetInnerHTML={{ 
                              __html: currentPattern.logos.find(
                                (l) => l.layout === 'square' && l.mode === 'dark'
                              )?.svg || '' 
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Download Button */}
                  <button
                    onClick={downloadZip}
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ダウンロード中...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        ロゴキットをダウンロード
                      </>
                    )}
                  </button>

                  {/* Included in Kit */}
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <h4 className="text-xs font-semibold text-white/70 mb-2">ダウンロード内容</h4>
                    <ul className="space-y-1.5 text-xs text-white/60">
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> SVG / PNG / JPEG（全パターン）</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> カラーパレット</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> 使用ガイドライン</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> 生成理由ドキュメント</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> Figma用最適化SVG</li>
                    </ul>
                  </div>

                  {/* Start Over */}
                  <button
                    onClick={() => { setStep(1); setPatterns(null); setServiceName(''); setServiceDescription(''); }}
                    className="w-full py-2.5 rounded-xl text-xs font-medium text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                  >
                    最初からやり直す
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div>© 2024 ドヤロゴ by DOYA AI</div>
          <div className="flex items-center gap-4">
            <span>日本っぽくてイケてるロゴを、誰でも簡単に。</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
