'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

const INDUSTRY_OPTIONS = [
  'IT・通信', '製造', '小売・卸売', '飲食・サービス',
  '医療・福祉', '教育', '建設・不動産', 'コンサルティング',
  '金融・保険', '広告・メディア', 'その他',
]

const SIZE_OPTIONS = [
  { value: '1-10', label: '1〜10名' },
  { value: '11-30', label: '11〜30名' },
  { value: '31-50', label: '31〜50名' },
  { value: '51-100', label: '51〜100名' },
  { value: '101+', label: '101名以上' },
]

export default function HrOnboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError('組織名を入力してください')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/hr/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), industry, size }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '組織の作成に失敗しました')
      }
      router.refresh()
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">ドヤHR へようこそ</h1>
              <p className="text-sm text-slate-500">まずは組織を作成しましょう</p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-8">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step ? 'bg-sky-500 flex-1' : 'bg-slate-200 flex-1'
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                組織名（会社名・チーム名）
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="例: 株式会社スリスタ"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-slate-900"
                autoFocus
              />
              <button
                onClick={() => orgName.trim() && setStep(1)}
                disabled={!orgName.trim()}
                className="w-full mt-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-sm font-bold text-slate-700 mb-2">業種</label>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {INDUSTRY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setIndustry(opt)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      industry === opt
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  戻る
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
                >
                  次へ
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-sm font-bold text-slate-700 mb-2">従業員数</label>
              <div className="space-y-2 mb-6">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSize(opt.value)}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all ${
                      size === opt.value
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  戻る
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      作成中...
                    </span>
                  ) : (
                    '組織を作成'
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
