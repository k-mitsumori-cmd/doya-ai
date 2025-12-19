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
  UploadCloud,
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
} from 'lucide-react'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const
const STORAGE_KEY = 'doya_seo_new_draft_v1'

// よく使うテンプレート
const TEMPLATES = [
  {
    id: 'comparison',
    name: '比較・ランキング記事',
    icon: '📊',
    title: '○○おすすめ10選【2024年最新】徹底比較',
    targetChars: 30000,
    searchIntent: '比較表/選び方/料金相場/メリット・デメリット/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: false, comparison: true, quotes: true, templates: true, objections: true },
  },
  {
    id: 'howto',
    name: 'ハウツー・解説記事',
    icon: '📖',
    title: '○○のやり方完全ガイド【初心者向け】',
    targetChars: 20000,
    searchIntent: '手順/注意点/よくある失敗/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: true, objections: true },
  },
  {
    id: 'definition',
    name: '用語解説・定義記事',
    icon: '📚',
    title: '○○とは？初心者でもわかる完全解説',
    targetChars: 15000,
    searchIntent: '定義/仕組み/種類/メリット・デメリット/活用例/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: false, objections: false },
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
]

export default function SeoNewPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [searchIntent, setSearchIntent] = useState('')
  const [targetChars, setTargetChars] = useState<number>(30000)
  const [referenceUrls, setReferenceUrls] = useState('')
  const [tone, setTone] = useState<(typeof TONES)[number]>('ビジネス')
  const [forbidden, setForbidden] = useState('')
  const [llmo, setLlmo] = useState({
    tldr: true,
    conclusionFirst: true,
    faq: true,
    glossary: true,
    comparison: true,
    quotes: true,
    templates: true,
    objections: true,
  })

  const [loading, setLoading] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [predictedOnce, setPredictedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTitle(t.title)
    setTargetChars(t.targetChars)
    setSearchIntent(t.searchIntent)
    setLlmo(t.llmo)
    setNotice(`「${t.name}」テンプレートを適用しました`)
    setTimeout(() => setNotice(null), 2500)
  }

  function fillSample() {
    setTitle('採用代行（RPO）徹底比較！おすすめ50社の特徴・料金、委託できる業務内容')
    setKeywords('採用代行, RPO, 採用アウトソーシング, 人事, 採用支援')
    setPersona('中堅企業の人事責任者。採用工数が逼迫しており、母集団形成〜面接調整を外注したい。失敗例や相場、選び方を知りたい。')
    setSearchIntent('定義/できること・できないこと/料金相場/比較表/選び方/失敗例/チェックリスト/FAQが欲しい')
    setTargetChars(50000)
    setReferenceUrls('')
    setTone('ビジネス')
    setForbidden('誇大表現NG, 競合名の断定的批判NG')
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
    setMode('full')
    setShowAdvanced(true)
    setNotice('サンプルを入力しました')
    setTimeout(() => setNotice(null), 2500)
  }

  const keywordList = useMemo(
    () =>
      keywords
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [keywords]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      setTitle(d.title || '')
      setKeywords(d.keywords || '')
      setPersona(d.persona || '')
      setSearchIntent(d.searchIntent || '')
      setTargetChars(Number(d.targetChars || 30000))
      setReferenceUrls(d.referenceUrls || '')
      setTone(d.tone || 'ビジネス')
      setForbidden(d.forbidden || '')
      setLlmo({ ...llmo, ...(d.llmo || {}) })
      if (d.title) setMode('full')
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function predictFromTitle(opts?: { silent?: boolean }) {
    const t = title.trim()
    if (t.length < 3) return

    setPredicting(true)
    if (!opts?.silent) setNotice(null)
    setError(null)
    try {
      const res = await fetch('/api/seo/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          seedKeywords: keywordList,
          tone,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '推定に失敗しました')

      const p = json.predicted || {}
      const personaText = String(p.persona || '').trim()
      const intentText = String(p.searchIntent || '').trim()
      const kws = Array.isArray(p.keywords) ? p.keywords.map((s: any) => String(s).trim()).filter(Boolean) : []

      if (!persona.trim() && personaText) setPersona(personaText)
      if (!searchIntent.trim() && intentText) setSearchIntent(intentText)
      if (!keywords.trim() && kws.length) setKeywords(kws.slice(0, 12).join(', '))

      setPredictedOnce(true)
      if (!opts?.silent) {
        setNotice('タイトルから読者/意図を推定して入力しました ✨')
        setTimeout(() => setNotice(null), 2500)
      }
    } catch (e: any) {
      if (!opts?.silent) setError(e?.message || '不明なエラー')
    } finally {
      setPredicting(false)
    }
  }

  useEffect(() => {
    if (predictedOnce) return
    if (!title.trim()) return
    if (persona.trim() || searchIntent.trim()) return

    const timer = setTimeout(() => {
      predictFromTitle({ silent: true })
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  function saveDraft() {
    const payload = { title, keywords, persona, searchIntent, targetChars, referenceUrls, tone, forbidden, llmo }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setNotice('下書きを保存しました 💾')
    setTimeout(() => setNotice(null), 2500)
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY)
    setNotice('下書きを削除しました')
    setTimeout(() => setNotice(null), 2500)
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        title,
        keywords: keywordList,
        persona,
        searchIntent,
        targetChars,
        referenceUrls: referenceUrls
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        tone,
        forbidden: forbidden
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        llmoOptions: llmo,
      }
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '作成に失敗しました')
      router.push(`/seo/articles/${json.articleId}?auto=1`)
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = title.trim().length > 0 && keywordList.length > 0

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/seo')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧へ戻る
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-900" />
              </div>
              新規記事作成
            </h1>
            <p className="text-white/70 mt-2">
              タイトルとキーワードを入力するだけで、高品質なSEO記事を自動生成します。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); fillSample() }}>
              <Sparkles className="w-4 h-4" />
              サンプル
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); saveDraft() }}>
              <Save className="w-4 h-4" />
              保存
            </Button>
          </div>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <p className="font-bold">エラー</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Template Picker */}
      <div className="mb-6">
        <p className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          テンプレートから始める
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              className="p-4 rounded-xl border border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group"
            >
              <span className="text-2xl">{t.icon}</span>
              <p className="text-sm font-bold text-white mt-2 group-hover:text-emerald-400 transition-colors">
                {t.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t.targetChars.toLocaleString()}字
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            記事の基本設定
          </CardTitle>
          <CardDesc>タイトルとキーワードは必須です。入力するとペルソナ・検索意図を自動推定します。</CardDesc>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <label className="block text-sm font-bold text-white">
                記事タイトル <span className="text-red-400">*</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => predictFromTitle()}
                disabled={predicting || !title.trim()}
              >
                <Wand2 className="w-4 h-4" />
                {predicting ? '推定中...' : 'AI推定'}
              </Button>
            </div>
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例）LLMOとは？SEOとの違いと実務で勝つための設計"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              キーワード <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例）LLMO, AI検索最適化, SEO（カンマ区切り）"
            />
            {keywordList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {keywordList.slice(0, 8).map((k) => (
                  <Badge key={k} tone="blue">{k}</Badge>
                ))}
                {keywordList.length > 8 && <Badge tone="gray">+{keywordList.length - 8}</Badge>}
              </div>
            )}
          </div>

          {/* Target & Tone */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-white mb-2">目標文字数</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:border-emerald-500"
                value={targetChars}
                onChange={(e) => setTargetChars(Number(e.target.value))}
              >
                {TARGETS.map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString('ja-JP')}字
                    {n >= 50000 && ' 🔥'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">トーン</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:border-emerald-500"
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Generated Fields */}
          <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-bold text-purple-300">AI自動入力（編集可）</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">想定読者（ペルソナ）</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder:text-gray-500 text-sm min-h-20 focus:outline-none focus:border-purple-500"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="タイトル入力で自動推定されます"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">検索意図</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder:text-gray-500 text-sm min-h-16 focus:outline-none focus:border-purple-500"
                value={searchIntent}
                onChange={(e) => setSearchIntent(e.target.value)}
                placeholder="タイトル入力で自動推定されます"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full mt-4 p-4 rounded-xl border border-gray-700 hover:border-gray-600 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-gray-400" />
          <span className="font-bold text-white">詳細設定</span>
          <span className="text-xs text-gray-500">参考URL・禁止事項・LLMO要素</span>
        </div>
        {showAdvanced ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                参考URL・制約
              </CardTitle>
              <CardDesc>競合記事のURLを入力すると、要点を抽出してより良い記事を生成します。</CardDesc>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">参考URL（複数入力可）</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 min-h-24 focus:outline-none focus:border-emerald-500"
                  value={referenceUrls}
                  onChange={(e) => setReferenceUrls(e.target.value)}
                  placeholder={`https://example.com/article\nhttps://example.com/another`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">禁止事項</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 min-h-16 focus:outline-none focus:border-emerald-500"
                  value={forbidden}
                  onChange={(e) => setForbidden(e.target.value)}
                  placeholder="例）競合A社名を出さない, 誇大表現NG"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                LLMO要素（ON/OFF）
              </CardTitle>
              <CardDesc>AI検索に強い記事構造をスイッチで制御します。</CardDesc>
            </CardHeader>
            <CardBody>
              <div className="grid md:grid-cols-2 gap-3">
                <Toggle checked={llmo.tldr} onChange={(v) => setLlmo({ ...llmo, tldr: v })} label="TL;DR" description="冒頭に要点を箇条書きで出力" />
                <Toggle checked={llmo.conclusionFirst} onChange={(v) => setLlmo({ ...llmo, conclusionFirst: v })} label="結論ファースト＋根拠" description="結論→理由→補足で迷子を防ぐ" />
                <Toggle checked={llmo.faq} onChange={(v) => setLlmo({ ...llmo, faq: v })} label="FAQ" description="構造化を意識したQ/A" />
                <Toggle checked={llmo.glossary} onChange={(v) => setLlmo({ ...llmo, glossary: v })} label="用語集" description="定義を固めて誤解を減らす" />
                <Toggle checked={llmo.comparison} onChange={(v) => setLlmo({ ...llmo, comparison: v })} label="比較表" description="意思決定を支える表を追加" />
                <Toggle checked={llmo.quotes} onChange={(v) => setLlmo({ ...llmo, quotes: v })} label="引用・根拠（言い換え）" description="参考URLの要点をオリジナルに整理" />
                <Toggle checked={llmo.templates} onChange={(v) => setLlmo({ ...llmo, templates: v })} label="実務テンプレ" description="チェックリスト/手順/例文" />
                <Toggle checked={llmo.objections} onChange={(v) => setLlmo({ ...llmo, objections: v })} label="反論に答える" description="読者の不安を先回りで潰す" />
              </div>

              <div className="mt-4 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
                <p className="text-xs font-bold text-gray-400 mb-2">クイック設定</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLlmo({ tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true })}
                  >
                    フル装備
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLlmo({ tldr: true, conclusionFirst: true, faq: true, glossary: false, comparison: true, quotes: true, templates: true, objections: true })}
                  >
                    実務寄り
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLlmo({ tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: false, objections: false })}
                  >
                    読み物寄り
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Submit Area */}
      <div className="mt-8 p-6 rounded-2xl border border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-400">
              準備完了
              {canSubmit && (
                <span className="ml-2 text-emerald-400">
                  ✓ {title.slice(0, 30)}{title.length > 30 ? '...' : ''} ({targetChars.toLocaleString()}字)
                </span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(llmo).filter(([, v]) => v).slice(0, 5).map(([k]) => (
                <Badge key={k} tone="purple">{k}</Badge>
              ))}
              {Object.values(llmo).filter(Boolean).length > 5 && (
                <Badge tone="gray">+{Object.values(llmo).filter(Boolean).length - 5}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/seo')}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={loading || !canSubmit}
              className="shadow-lg shadow-emerald-500/25"
            >
              <UploadCloud className="w-4 h-4" />
              {loading ? '作成中...' : '記事を生成'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 rounded-xl border border-gray-700 bg-gray-800/30">
        <p className="text-xs font-bold text-gray-500 mb-2">💡 ヒント</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• タイトルを入力するとAIがペルソナ・検索意図を自動推定します</li>
          <li>• 50,000字以上の長文記事も分割生成で安定して生成できます</li>
          <li>• 参考URLを入力すると、競合記事を分析してより良い記事を生成します</li>
        </ul>
      </div>
    </main>
  )
}
