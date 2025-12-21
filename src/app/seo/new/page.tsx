'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Button } from '@seo/components/ui/Button'
import { Toggle } from '@seo/components/ui/Toggle'
import { Badge } from '@seo/components/ui/Badge'
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
  X,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { FeatureGuide } from '@/components/FeatureGuide'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const
const STORAGE_KEY = 'doya_seo_new_draft_v1'

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
]

export default function SeoNewArticlePage() {
  const router = useRouter()
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
  const [notice, setNotice] = useState<string | null>(null)

  const keywordList = useMemo(() => {
    return keywords.split(/[,、\s]+/).filter(Boolean)
  }, [keywords])

  const canSubmit = title.trim().length > 0 && keywordList.length > 0

  // 1. サンプル入力
  function fillSample() {
    setTitle('RPO（採用代行）おすすめ比較50選｜選び方と料金相場【2024年最新】')
    setKeywords('RPO, 採用代行, 比較, 料金, おすすめ')
    setTargetChars(50000)
    setPersona('採用に課題を感じている企業の人事責任者、経営層。コスト削減と採用質向上を両立させたい層。')
    setSearchIntent('RPOの主要プレイヤーを一覧で比較したい。自社に合うサービスの選び方を知りたい。相場感と導入メリットを把握したい。')
    setLlmo({
      tldr: true,
      conclusionFirst: true,
      faq: true,
      glossary: true,
      comparison: true,
      quotes: true,
      templates: true,
      objections: true,
    })
    setNotice('サンプルデータを入力しました')
    setTimeout(() => setNotice(null), 3000)
  }

  // 2. ドラフト保存・読込
  function saveDraft() {
    const data = { title, keywords, targetChars, tone, persona, searchIntent, referenceUrls, forbidden, llmo, autoBundle, requestText }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setNotice('ドラフトを保存しました')
    setTimeout(() => setNotice(null), 3000)
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
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
    setNotice(`${t.name}テンプレートを適用しました`)
    setTimeout(() => setNotice(null), 3000)
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
    try {
      const urls = referenceUrls.split('\n').map(u => u.trim()).filter(Boolean)
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          keywords: keywordList,
          targetChars,
          tone,
          persona,
          searchIntent,
          referenceUrls: urls,
          forbidden: forbidden.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean),
          llmoOptions: llmo,
          requestText,
          referenceImages,
          autoBundle,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '作成に失敗しました')

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
    <DashboardLayout>
      <main className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-0">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
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
            <Button variant="ghost" size="sm" onClick={fillSample} className="flex-1 sm:flex-none text-gray-400 hover:text-blue-600 border border-gray-100 sm:border-none">
              <Sparkles className="w-4 h-4 mr-2" /> サンプル
            </Button>
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
              />
            </div>
          </div>
        </div>

        {notice && (
          <div className="mb-6 p-4 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-700 text-sm font-bold flex items-center gap-3 border border-blue-100 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl sm:rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm animate-fade-in">
            <p className="font-bold flex items-center gap-2"><X className="w-4 h-4" /> エラーが発生しました</p>
            <p className="mt-1 ml-6">{error}</p>
          </div>
        )}

        <div className="space-y-6 sm:space-y-8">
          {/* Simple Inputs Card */}
          <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
            <div className="grid gap-6 sm:gap-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] sm:text-sm font-black text-gray-700 uppercase tracking-wider">記事タイトル</label>
                  <button
                    onClick={predictFromTitle}
                    disabled={predicting || !title.trim()}
                    className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {predicting ? '推定中...' : 'AIにおまかせ入力'}
                  </button>
                </div>
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
                  <select
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold appearance-none"
                    value={targetChars}
                    onChange={(e) => setTargetChars(Number(e.target.value))}
                  >
                    {TARGETS.map((n) => (
                      <option key={n} value={n}>{n.toLocaleString()}字</option>
                    ))}
                  </select>
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
          </div>

          {/* Template Picker */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Quick Templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                >
                  <span className="text-2xl mb-2 block">{t.icon}</span>
                  <p className="text-sm font-black text-gray-900 leading-tight group-hover:text-blue-600">{t.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">{t.targetChars.toLocaleString()} CHARS</p>
                </button>
              ))}
            </div>
          </div>

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
          <div className="space-y-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
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
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-3">想定ターゲット</label>
                    <textarea
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      placeholder="誰に向けて書く記事ですか？"
                    />
                  </div>
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-5 sm:p-6">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-3">検索意図・ニーズ</label>
                    <textarea
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 text-sm min-h-[100px] focus:outline-none focus:border-blue-500"
                      value={searchIntent}
                      onChange={(e) => setSearchIntent(e.target.value)}
                      placeholder="読者は何を知りたいですか？"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8">
                  <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> LLMO（AI最適化）要素
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {Object.entries(llmo).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <span className="text-[10px] font-black text-gray-600 uppercase">{key}</span>
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
          <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-4">
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
                  生成を開始中...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  記事を生成する
                  <ArrowRight className="w-6 h-6" />
                </div>
              )}
            </Button>
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}
