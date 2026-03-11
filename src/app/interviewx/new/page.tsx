'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Loader2, Search, CheckCircle, AlertCircle,
  Briefcase, Star, ClipboardList, Building2, BarChart3, Rocket, PenLine, Plus
} from 'lucide-react'
import Link from 'next/link'

const TONE_OPTIONS = [
  { value: 'professional', label: '丁寧・誠実' },
  { value: 'friendly', label: 'フレンドリー' },
]

const CATEGORY_ICONS: Record<string, any> = {
  BUSINESS_MEETING: Briefcase,
  SERVICE_RESEARCH: Search,
  CUSTOMER_SATISFACTION: Star,
  REQUIREMENTS: ClipboardList,
  INTERNAL_HEARING: Building2,
  COMPETITOR_ANALYSIS: BarChart3,
  NEW_BUSINESS: Rocket,
  CUSTOM: PenLine,
}

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [form, setForm] = useState({
    title: '',
    companyName: '',
    companyUrl: '',
    respondentName: '',
    respondentEmail: '',
    purpose: '',
    targetAudience: '',
    tone: 'professional',
    brandColor: '#6366f1',
    customInstructions: '',
  })

  // URL調査状態
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    fetch('/api/interviewx/templates')
      .then(r => r.json())
      .then(data => {
        if (data.success) setTemplates(data.templates || [])
        else setError(data.error || 'テンプレートの読み込みに失敗しました')
      })
      .catch(() => setError('テンプレートの読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!selectedTemplate || !form.title.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/interviewx/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          templateId: selectedTemplate.id,
          hearingType: selectedTemplate.category,
        }),
      })
      const data = await res.json()
      if (data.success && data.project) {
        if (form.companyUrl && !analysisResult) {
          fetch(`/api/interviewx/projects/${data.project.id}/analyze-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: form.companyUrl }),
          }).catch(() => {})
        }
        if (analysisResult) {
          fetch(`/api/interviewx/projects/${data.project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyAnalysis: analysisResult }),
          }).catch(() => {})
        }
        router.push(`/interviewx/projects/${data.project.id}/questions`)
      } else {
        setError(data.error || 'プロジェクトの作成に失敗しました')
      }
    } catch (e) {
      setError('通信エラーが発生しました。ページを再読み込みしてお試しください。')
    } finally {
      setCreating(false)
    }
  }

  const handleAnalyzeUrl = async () => {
    if (!form.companyUrl.trim()) return
    setAnalyzing(true)
    setAnalysisError('')
    setAnalysisResult(null)
    try {
      const res = await fetch('/api/interviewx/analyze-url-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.companyUrl }),
      })
      const data = await res.json()
      if (data.success) {
        setAnalysisResult(data.analysis)
        if (!form.companyName && data.analysis?.companyName) {
          setForm(prev => ({ ...prev, companyName: data.analysis.companyName }))
        }
      } else {
        setAnalysisError(data.error || 'URL調査に失敗しました')
      }
    } catch {
      setAnalysisError('URL調査に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/interviewx" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">新規ヒヤリング作成</h1>
      <p className="text-sm text-slate-500 mb-6">
        {step === 1
          ? 'ヒヤリングのカテゴリを選んでください。AIが目的に合った質問を自動生成します。'
          : '効率的なヒヤリングシートをAIが自動生成します。'}
      </p>

      {/* ステップタブ */}
      <div className="flex items-center gap-1 mb-8 border-b border-slate-200">
        <button
          onClick={() => step === 2 && setStep(1)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            step === 1
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {step > 1 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">1</span>}
          カテゴリ選択
        </button>
        <button
          disabled={step < 2}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            step === 2
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400'
          }`}
        >
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
          ヒヤリング設定
        </button>
      </div>

      {/* Step 1: カテゴリ選択 */}
      {step === 1 && (
        <div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map(tpl => {
                  const IconComp = CATEGORY_ICONS[tpl.category] || ClipboardList
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl)
                        setForm(prev => ({ ...prev, title: '' }))
                        setError('')
                        setStep(2)
                      }}
                      className="text-left p-5 rounded-xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-md group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                        <IconComp className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-0.5">{tpl.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>
                    </button>
                  )
                })}
              </div>

              {selectedTemplate && (
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    次へ進む
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: ヒヤリング設定 */}
      {step === 2 && selectedTemplate && (
        <div>
          {/* 選択カテゴリ */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg mb-6">
            <div className="flex items-center gap-3">
              {(() => {
                const IconComp = CATEGORY_ICONS[selectedTemplate.category] || ClipboardList
                return (
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <IconComp className="w-4 h-4 text-indigo-600" />
                  </div>
                )
              })()}
              <div>
                <p className="text-[10px] text-indigo-500 font-medium">選択中のカテゴリ</p>
                <p className="text-sm font-bold text-indigo-700">{selectedTemplate.name}</p>
              </div>
            </div>
            <button onClick={() => { setStep(1); setAnalysisResult(null); setAnalysisError('') }} className="text-xs text-indigo-600 hover:underline font-medium">変更する</button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="space-y-5">
              {/* ヒヤリング名 */}
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">ヒヤリング名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例: 株式会社ABC 商談ヒヤリング"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* URL調査セクション */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                <label className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-indigo-500" />
                  相手先のURL（事前調査）
                </label>
                <p className="text-xs text-slate-500 mb-3">URLを入力してAIで事前調査すると、会社の事業内容やプレスリリースを分析し、より的確なヒヤリング質問を生成できます。</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.companyUrl}
                    onChange={e => { setForm(prev => ({ ...prev, companyUrl: e.target.value })); setAnalysisResult(null); setAnalysisError('') }}
                    placeholder="https://example.com"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAnalyzeUrl}
                    disabled={analyzing || !form.companyUrl.trim()}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />調査中...</>
                    ) : (
                      <><Plus className="w-4 h-4" />AI調査を実行</>
                    )}
                  </button>
                </div>
                {analysisError && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {analysisError}
                  </div>
                )}
                {analysisResult && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-100">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-green-600 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      調査完了
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      {analysisResult.companyName && <p><span className="font-medium text-slate-700">企業名:</span> {analysisResult.companyName}</p>}
                      {analysisResult.businessDescription && <p><span className="font-medium text-slate-700">事業:</span> {analysisResult.businessDescription}</p>}
                      {analysisResult.industry && <p><span className="font-medium text-slate-700">業界:</span> {analysisResult.industry}</p>}
                      {analysisResult.services?.length > 0 && <p><span className="font-medium text-slate-700">サービス:</span> {analysisResult.services.join(', ')}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* 企業名 + 回答者名 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">企業名</label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="株式会社〇〇"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">回答者名</label>
                  <input
                    type="text"
                    value={form.respondentName}
                    onChange={e => setForm(prev => ({ ...prev, respondentName: e.target.value }))}
                    placeholder="山田 太郎 様"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 回答者メール */}
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">回答者メールアドレス</label>
                <input
                  type="email"
                  value={form.respondentEmail}
                  onChange={e => setForm(prev => ({ ...prev, respondentEmail: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* ヒヤリングの目的 */}
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">ヒヤリングの目的</label>
                <input
                  type="text"
                  value={form.purpose}
                  onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="新規導入検討の課題抽出"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 対象者 */}
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">対象者（役職・属性）</label>
                <input
                  type="text"
                  value={form.targetAudience}
                  onChange={e => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="経営者、マーケティング担当、エンジニアなど"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* トーン + ブランドカラー */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">ヒヤリングのトーン</label>
                  <div className="flex gap-2">
                    {TONE_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setForm(prev => ({ ...prev, tone: o.value }))}
                        className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          form.tone === o.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 block">ブランドカラー</label>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-slate-300">
                    <input
                      type="color"
                      value={form.brandColor}
                      onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
                      className="w-8 h-8 rounded-md border-0 cursor-pointer"
                    />
                    <span className="text-sm text-slate-500">デフォルト (indigo)</span>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, brandColor: '#6366f1' }))}
                      className="ml-auto text-xs text-indigo-600 hover:underline"
                    >
                      色を選択
                    </button>
                  </div>
                </div>
              </div>

              {/* 追加指示 */}
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">AIへの追加指示（自由入力）</label>
                <textarea
                  value={form.customInstructions}
                  onChange={e => setForm(prev => ({ ...prev, customInstructions: e.target.value }))}
                  placeholder="特に深堀りしたい課題や、避けてほしい質問などがあれば入力してください。"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* ボタンエリア */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setStep(1); setAnalysisResult(null); setAnalysisError('') }}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              戻る
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />作成中...</>
              ) : (
                <>作成して質問生成へ <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
