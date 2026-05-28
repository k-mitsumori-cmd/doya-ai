'use client'

import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

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
    if (!serviceInput.trim()) {
      toast.error('サービス内容またはURLを入力してください')
      return
    }
    setGenerating(true)
    setResult('')
    const tid = toast.loading('🐻 AIが文章を作成中...')
    try {
      const res = await fetch('/api/doyalist/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, serviceInput, targetIndustry, tone }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || '生成に失敗しました', { id: tid })
        return
      }
      setResult(data.text || '')
      toast.success('🎉 完成しました！', { id: tid })
    } catch (e: any) {
      toast.error(e?.message || '通信エラー', { id: tid })
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result).then(() => {
      toast.success('📋 コピーしました！')
    })
  }

  const isUrl = /^https?:\/\//.test(serviceInput.trim())

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1530] via-[#13234d] to-[#0a1530] p-4 lg:p-8 text-white">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#13234d', color: '#fff', border: '1px solid rgba(56, 189, 248, 0.3)' },
        }}
      />

      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        {/* Hero */}
        <div className="text-center pt-4 pb-2">
          <div className="text-5xl mb-2">{emoji}</div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 to-lime-300 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-sm font-bold text-cyan-300/80 mt-1">{subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-2xl shadow-cyan-500/10 border-2 border-cyan-400/30 p-6 lg:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-cyan-400/20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-lime-300 flex items-center justify-center text-2xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-black text-white">2つ入力するだけ ⚡</h2>
              <p className="text-xs font-bold text-cyan-300/80">企業名・担当者名はAIが仮で入れます</p>
            </div>
          </div>

          {/* 自社サービス */}
          <div>
            <label className="block text-sm font-black text-cyan-200 mb-2">
              ✨ 自社サービスの内容 または URL <span className="text-lime-300">*必須</span>
            </label>
            <textarea
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              placeholder={'例: AIで営業リストを自動生成するSaaSツール\nまたは https://doya-ai.surisuta.jp'}
              rows={3}
              className="w-full px-4 py-3 border-2 border-cyan-400/30 rounded-2xl text-sm font-medium text-white bg-[#0a1530]/60 placeholder:text-cyan-300/40 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 resize-none"
            />
            {isUrl && (
              <p className="text-xs font-bold text-lime-300 mt-1">🔗 URLとして認識：AIがサイトの内容を推定します</p>
            )}
          </div>

          {/* 相手の業種 */}
          <div>
            <label className="block text-sm font-black text-cyan-200 mb-2">
              🎯 相手の業種 <span className="text-lime-300">*必須</span>
            </label>
            <select
              value={targetIndustry}
              onChange={(e) => setTargetIndustry(e.target.value)}
              className="w-full px-4 py-3 border-2 border-cyan-400/30 rounded-2xl text-sm font-bold text-white bg-[#0a1530]/60 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 cursor-pointer"
            >
              {INDUSTRIES.map((i) => <option key={i} value={i} className="bg-[#0a1530]">{i}</option>)}
            </select>
          </div>

          {/* トーン */}
          <div>
            <label className="block text-sm font-black text-cyan-200 mb-2">💬 トーン</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'formal', l: '丁寧・フォーマル' },
                { v: 'friendly', l: '親しみやすい' },
                { v: 'casual', l: 'カジュアル' },
              ].map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTone(t.v)}
                  className={`py-3 rounded-2xl text-xs font-black transition-all ${
                    tone === t.v
                      ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-[#0a1530] shadow-lg shadow-cyan-400/50 scale-105'
                      : 'bg-[#0a1530]/60 text-cyan-200 hover:bg-[#0a1530] border border-cyan-400/20'
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
            className="w-full py-4 bg-gradient-to-r from-cyan-400 via-sky-400 to-lime-300 text-[#0a1530] font-black text-lg rounded-2xl shadow-xl shadow-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-400/60 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <span className="inline-block animate-spin">⚡</span>
                作成中...
              </>
            ) : (
              <>⚡ 文章を作成する 🚀</>
            )}
          </button>
        </div>

        {generating && !result && (
          <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-xl border-2 border-cyan-400/30 p-10 text-center space-y-3">
            <div className="text-6xl animate-bounce">🐻</div>
            <p className="text-lg font-black text-cyan-200">クマが考え中...</p>
          </div>
        )}

        {result && (
          <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-2xl shadow-cyan-500/10 border-2 border-cyan-400/30 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-lime-300/20 border-b-2 border-cyan-400/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎉</div>
                <div>
                  <h2 className="text-base font-black text-white">完成しました！</h2>
                  <p className="text-xs font-bold text-cyan-300">企業名・担当者名は仮置きです（カスタマイズしてご利用ください）</p>
                </div>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2.5 bg-cyan-400 text-[#0a1530] font-black text-sm rounded-2xl shadow-lg hover:bg-cyan-300 active:scale-95 transition-all"
              >
                📋 コピー
              </button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm font-medium text-cyan-100 leading-relaxed font-sans">
                {result}
              </pre>
            </div>
            <div className="p-4 bg-gradient-to-r from-cyan-400/10 to-lime-300/10 border-t-2 border-cyan-400/30 flex items-center justify-center gap-2">
              <span className="text-2xl">🐻</span>
              <p className="text-xs font-bold text-cyan-200">気に入ったらコピーして使ってください！</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
