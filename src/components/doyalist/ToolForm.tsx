'use client'

import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

const CHARS = {
  point: '/kintai/characters/point_解説.png',
  working: '/kintai/characters/working_作業中.png',
  jump: '/kintai/characters/jump_大喜び.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  success: '/kintai/characters/success_成功.png',
}

const INDUSTRIES = ['IT・ソフトウェア', '製造業', '小売・EC', '医療・介護', '教育', '金融・保険', '不動産', '飲食', '物流', '建設', 'コンサル', '広告・マーケ', '人材', 'その他']

interface Props {
  type: 'form' | 'email' | 'phone'
  title: string
  subtitle: string
  emoji: string
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        {/* Hero */}
        <div className="text-center pt-4 pb-2">
          <div className="text-4xl mb-2">{emoji}</div>
          <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">{title}</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <img src={CHARS.point} alt="" className="w-11 h-11" />
            <div>
              <h2 className="text-base font-bold text-[#0a1530]">2つ入力するだけ</h2>
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
                    tone === t.v
                      ? 'bg-[#0a1530] text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
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
            className="w-full py-4 bg-[#0a1530] text-white font-bold text-base rounded-xl shadow-lg shadow-[#0a1530]/20 hover:bg-[#13234d] hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <><img src={CHARS.working} alt="" className="w-6 h-6 animate-spin" />作成中...</>
            ) : (
              <><img src={CHARS.jump} alt="" className="w-6 h-6" />文章を作成する</>
            )}
          </button>
        </div>

        {generating && !result && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-10 text-center space-y-3">
            <img src={CHARS.thinking} alt="" className="w-24 h-24 mx-auto animate-bounce" />
            <p className="text-base font-bold text-[#0a1530]">クマが考え中...</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-cyan-50 to-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🎉</div>
                <div>
                  <h2 className="text-base font-bold text-[#0a1530]">完成しました</h2>
                  <p className="text-xs text-slate-500">企業名・担当者名は仮置きです（適宜カスタマイズしてください）</p>
                </div>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2.5 bg-[#0a1530] text-white font-bold text-sm rounded-xl shadow hover:bg-[#13234d] active:scale-95 transition-all"
              >
                📋 コピー
              </button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
