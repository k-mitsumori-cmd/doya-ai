'use client'

import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

const CHARS = {
  hello: '/kintai/characters/hello_挨拶.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  working: '/kintai/characters/working_作業中.png',
  jump: '/kintai/characters/jump_大喜び.png',
  success: '/kintai/characters/success_成功.png',
  point: '/kintai/characters/point_解説.png',
  thumbsup: '/kintai/characters/thumbsup_いいね.png',
  love: '/kintai/characters/love_大好き.png',
}

interface Props {
  type: 'form' | 'email' | 'phone'
  title: string
  subtitle: string
  emoji: string
  charHero: string
}

export default function ToolForm({ type, title, subtitle, emoji, charHero }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [myCompany, setMyCompany] = useState('')
  const [myService, setMyService] = useState('')
  const [benefit, setBenefit] = useState('')
  const [tone, setTone] = useState('formal')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')

  const handleGenerate = async () => {
    if (!myService.trim()) {
      toast.error('自社サービスを入力してください')
      return
    }
    setGenerating(true)
    setResult('')
    const tid = toast.loading('🐻 AIが文章を作成中...')
    try {
      const res = await fetch('/api/doyalist/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, companyName, industry, contactPerson, myCompany, myService, benefit, tone }),
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-violet-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        {/* Hero */}
        <div className="text-center pt-4 pb-2">
          <img src={charHero} alt="" className="w-24 h-24 mx-auto" />
          <h1 className="text-3xl font-black bg-gradient-to-r from-[#7f19e6] to-pink-500 bg-clip-text text-transparent mt-2">
            {emoji} {title}
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 border-2 border-purple-100 p-6 lg:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-purple-100">
            <img src={CHARS.point} alt="" className="w-14 h-14" />
            <div>
              <h2 className="text-lg font-black text-slate-800">情報を入力してください</h2>
              <p className="text-xs font-bold text-slate-400">「自社サービス」だけ必須、あとは任意でOK</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="🏢 相手企業名" value={companyName} onChange={setCompanyName} placeholder="例: 株式会社サンプル" />
            <Field label="💼 業界" value={industry} onChange={setIndustry} placeholder="例: 製造業" />
            <Field label="👤 担当者" value={contactPerson} onChange={setContactPerson} placeholder="例: 山田様" />
            <Field label="🎀 自社名" value={myCompany} onChange={setMyCompany} placeholder="例: 株式会社スリスタ" />
          </div>

          <Field
            label={<>✨ 自社サービス <span className="text-rose-500">*必須</span></>}
            value={myService}
            onChange={setMyService}
            placeholder="例: AIで営業リストを自動生成するSaaS"
            multiline
          />

          <Field
            label="💎 訴求ポイント（任意）"
            value={benefit}
            onChange={setBenefit}
            placeholder="例: 月100時間の営業工数削減、コスト1/10"
            multiline
          />

          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">💬 トーン</label>
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
                      ? 'bg-gradient-to-r from-[#7f19e6] to-pink-500 text-white shadow-lg scale-105'
                      : 'bg-purple-50 text-slate-600 hover:bg-purple-100'
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
            className="w-full py-4 bg-gradient-to-r from-[#7f19e6] via-pink-500 to-rose-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-purple-300/50 hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <img src={CHARS.working} alt="" className="w-8 h-8 animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <img src={CHARS.jump} alt="" className="w-8 h-8" />
                文章を作成する 🚀
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {generating && !result && (
          <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-100 p-10 text-center space-y-3">
            <img src={CHARS.thinking} alt="" className="w-32 h-32 mx-auto animate-bounce" />
            <p className="text-lg font-black text-slate-700">クマが考え中...</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 border-2 border-purple-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-100 via-pink-50 to-rose-50 border-b-2 border-purple-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <img src={CHARS.success} alt="" className="w-12 h-12" />
                <div>
                  <h2 className="text-base font-black text-slate-800">完成しました！</h2>
                  <p className="text-xs font-bold text-slate-500">そのまま使えます ✨</p>
                </div>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2.5 bg-[#7f19e6] text-white font-black text-sm rounded-2xl shadow-lg hover:bg-[#6a14c2] active:scale-95 transition-all"
              >
                📋 コピー
              </button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm font-medium text-slate-700 leading-relaxed font-sans">
                {result}
              </pre>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-t-2 border-purple-100 flex items-center justify-center gap-2">
              <img src={CHARS.love} alt="" className="w-8 h-8" />
              <p className="text-xs font-bold text-slate-600">気に入ったらコピーして使ってください！</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-700 mb-2">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-medium text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-medium text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100"
        />
      )}
    </div>
  )
}
