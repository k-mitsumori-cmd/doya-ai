'use client'

import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { INDUSTRIES } from '@/lib/doyalist/constants'

const CHARS = {
  point: '/kintai/characters/point_解説.png',
  working: '/kintai/characters/working_作業中.png',
  jump: '/kintai/characters/jump_大喜び.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  success: '/kintai/characters/success_成功.png',
}

interface Props {
  type: 'form' | 'email' | 'phone'
  title: string
  subtitle: string
  emoji: string
}

const TIPS_BY_TYPE: Record<string, string[]> = {
  form: [
    '冒頭で会社の課題に触れる',
    '自社サービスの具体的な価値を示す',
    'CTAは「15分の打ち合わせ」など軽め',
    '一方的な売り込みは避ける',
  ],
  email: [
    '件名は30字以内で開封率重視',
    '本文は導入→価値提案→次のアクション',
    '装飾記号や絵文字は避ける',
    'プレースホルダで宛先を明示',
  ],
  phone: [
    '受付突破フレーズを冒頭に',
    '想定問答と切り返しトーク付き',
    '「お忙しい所」など配慮の言葉',
    '3〜5回のやりとりを想定',
  ],
}

export default function ToolForm({ type, title, subtitle, emoji }: Props) {
  const [serviceInput, setServiceInput] = useState('')
  const [targetIndustry, setTargetIndustry] = useState('IT・ソフトウェア')
  const [tone, setTone] = useState('formal')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')

  const handleGenerate = async () => {
    if (!serviceInput.trim()) { toast.error('サービス内容またはURLを入力してください'); return }
    setGenerating(true); setResult('')
    const tid = toast.loading('AIが文章を作成中...')
    try {
      const res = await fetch('/api/doyalist/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, serviceInput, targetIndustry, tone }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error || '生成に失敗しました', { id: tid }); return }
      setResult(data.text || '')
      toast.success('完成しました！', { id: tid })
    } catch (e: any) {
      toast.error(e?.message || '通信エラー', { id: tid })
    } finally { setGenerating(false) }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result).then(() => toast.success('コピーしました'))
  }

  const isUrl = /^https?:\/\//.test(serviceInput.trim())
  const tips = TIPS_BY_TYPE[type] || []

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md text-2xl">
            {emoji}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">{title}</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Form (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:p-8 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <img src={CHARS.point} alt="" className="w-10 h-10" />
                <div>
                  <h2 className="text-base font-bold text-[#0a1530]">入力は2ステップだけ</h2>
                  <p className="text-xs text-slate-500">企業名・担当者名はAIが仮で入れます</p>
                </div>
              </div>

              {/* 自社サービス */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  ✨ 自社サービスの内容 または URL <span className="text-rose-500 text-xs">*必須</span>
                </label>
                <textarea
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  placeholder={'例: AIで営業リストを自動生成するSaaSツール\nまたは https://doya-ai.surisuta.jp'}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 resize-none"
                />
                {isUrl && (<p className="text-xs font-bold text-cyan-600 mt-1">🔗 URLとして認識：AIがサイトの内容を推定します</p>)}
              </div>

              {/* 相手の業種 */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  🎯 相手の業種 <span className="text-rose-500 text-xs">*必須</span>
                </label>
                <select
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 cursor-pointer"
                >
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* トーン */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">💬 トーン</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'formal', l: '丁寧・フォーマル' },
                    { v: 'friendly', l: '親しみやすい' },
                    { v: 'casual', l: 'カジュアル' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => setTone(t.v)}
                      className={`py-3 rounded-xl text-xs font-bold transition-all ${
                        tone === t.v ? 'bg-[#0a1530] text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-base rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><img src={CHARS.working} alt="" className="w-6 h-6 animate-spin" />作成中...</>
                ) : (
                  <><img src={CHARS.jump} alt="" className="w-6 h-6" />文章を作成する</>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: Preview (1/3) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="text-xl">📝</span>
                <h3 className="text-sm font-bold text-[#0a1530]">生成プレビュー</h3>
              </div>

              {!result && !generating && (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-slate-500 mb-3">この内容で作成されます</p>
                  <div className="space-y-2">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-600 text-left">
                        <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generating && (
                <div className="py-6 text-center space-y-3">
                  <img src={CHARS.thinking} alt="" className="w-20 h-20 mx-auto animate-bounce" />
                  <p className="text-sm font-bold text-[#0a1530]">クマが考え中...</p>
                </div>
              )}

              {result && (
                <div className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">生成結果</span>
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 bg-[#0a1530] text-white font-bold text-xs rounded-lg hover:bg-[#13234d] active:scale-95 transition-all"
                    >
                      📋 コピー
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans">{result}</pre>
                  </div>
                  <p className="text-[10px] text-slate-400">企業名・担当者名は仮置きです（適宜カスタマイズしてご利用ください）</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
