'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

const TONE_OPTIONS = [
  { value: 'professional', label: 'プロフェッショナル' },
  { value: 'friendly', label: '親しみやすい' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'formal', label: 'フォーマル' },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

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
    wordCountTarget: 3000,
    brandColor: '#6366f1',
    customInstructions: '',
    interviewMode: 'survey' as 'survey' | 'chat',
  })

  useEffect(() => {
    fetch('/api/interviewx/templates')
      .then(r => r.json())
      .then(data => {
        if (data.success) setTemplates(data.templates || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!selectedTemplate || !form.title.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/interviewx/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          templateId: selectedTemplate.id,
          articleType: selectedTemplate.category,
        }),
      })
      const data = await res.json()
      if (data.success && data.project) {
        router.push(`/interviewx/projects/${data.project.id}/questions`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/interviewx" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">新規プロジェクト作成</h1>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${step >= 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
          1. テンプレート選択
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${step >= 2 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
          2. プロジェクト設定
        </div>
      </div>

      {/* Step 1: テンプレート選択 */}
      {step === 1 && (
        <div>
          <p className="text-slate-500 mb-6">作成する記事のテンプレートを選んでください。</p>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setSelectedTemplate(tpl)
                    setForm(prev => ({ ...prev, title: '' }))
                    setStep(2)
                  }}
                  className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                    selectedTemplate?.id === tpl.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="text-3xl mb-3">{tpl.icon || '📋'}</div>
                  <h3 className="font-bold text-slate-900 mb-1">{tpl.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">{tpl.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: プロジェクト設定 */}
      {step === 2 && selectedTemplate && (
        <div>
          <div className="flex items-center gap-3 mb-6 p-3 bg-indigo-50 rounded-xl">
            <span className="text-2xl">{selectedTemplate.icon}</span>
            <div>
              <p className="font-bold text-indigo-700">{selectedTemplate.name}</p>
              <button onClick={() => setStep(1)} className="text-xs text-indigo-500 hover:underline">変更する</button>
            </div>
          </div>

          <div className="space-y-5">
            {/* インタビューモード選択 */}
            <div>
              <label className="text-sm font-bold text-slate-700 mb-2 block">インタビュー方式</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, interviewMode: 'survey' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.interviewMode === 'survey'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="text-2xl mb-2">📋</div>
                  <p className="font-bold text-slate-900 text-sm">アンケート形式</p>
                  <p className="text-xs text-slate-500 mt-1">全質問を一括フォームで回答</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, interviewMode: 'chat' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.interviewMode === 'chat'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="text-2xl mb-2">💬</div>
                  <p className="font-bold text-slate-900 text-sm">AIチャット形式</p>
                  <p className="text-xs text-slate-500 mt-1">AIが対話で深掘りインタビュー</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">プロジェクト名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="例: 株式会社〇〇 導入事例インタビュー"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">企業名</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="株式会社〇〇"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">企業URL</label>
                <input
                  type="url"
                  value={form.companyUrl}
                  onChange={e => setForm(prev => ({ ...prev, companyUrl: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">回答者名</label>
                <input
                  type="text"
                  value={form.respondentName}
                  onChange={e => setForm(prev => ({ ...prev, respondentName: e.target.value }))}
                  placeholder="山田太郎"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">回答者メール</label>
                <input
                  type="email"
                  value={form.respondentEmail}
                  onChange={e => setForm(prev => ({ ...prev, respondentEmail: e.target.value }))}
                  placeholder="yamada@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">記事の目的</label>
              <input
                type="text"
                value={form.purpose}
                onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="例: 自社サービスの導入効果を伝え、新規顧客を獲得する"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">想定読者</label>
              <input
                type="text"
                value={form.targetAudience}
                onChange={e => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                placeholder="例: 同業種の中小企業の経営者・マーケティング担当者"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">トーン</label>
                <select
                  value={form.tone}
                  onChange={e => setForm(prev => ({ ...prev, tone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">目標文字数</label>
                <input
                  type="number"
                  value={form.wordCountTarget}
                  onChange={e => setForm(prev => ({ ...prev, wordCountTarget: Number(e.target.value) }))}
                  min={500}
                  max={10000}
                  step={500}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">ブランドカラー</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.brandColor}
                    onChange={e => setForm(prev => ({ ...prev, brandColor: e.target.value }))}
                    className="w-12 h-12 rounded-xl border border-slate-300 cursor-pointer"
                  />
                  <span className="text-sm text-slate-500 font-mono">{form.brandColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">追加指示（任意）</label>
              <textarea
                value={form.customInstructions}
                onChange={e => setForm(prev => ({ ...prev, customInstructions: e.target.value }))}
                placeholder="AIへの追加指示があれば入力してください..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    作成中...
                  </>
                ) : (
                  <>
                    作成して質問生成へ
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
