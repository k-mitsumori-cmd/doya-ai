'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const STEP_CHARACTERS = [
  '/hr/characters/hello_挨拶.png',
  '/hr/characters/focus_集中.png',
  '/hr/characters/success_成功.png',
]

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

const STEP_LABELS = ['組織名', '業種', '規模']

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-white to-green-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">ドヤHR へようこそ!</h1>
              <p className="text-base font-bold text-gray-500">かんたんに組織を作成しましょう</p>
            </div>
          </div>

          {/* Google-style Stepper */}
          <div className="mb-8 px-2">
            <div className="flex items-center">
              {STEP_LABELS.map((label, s) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                      s < step
                        ? 'bg-blue-600 text-white'
                        : s === step
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s < step ? (
                      <span className="material-symbols-outlined text-lg">check</span>
                    ) : (
                      s + 1
                    )}
                  </div>
                  {s < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex">
              {STEP_LABELS.map((label, s) => (
                <div key={s} className="flex-1 last:flex-none">
                  <span className={`block text-center text-xs font-bold mt-1.5 ${s <= step ? 'text-blue-600' : 'text-gray-400'} ${s < STEP_LABELS.length - 1 ? '' : 'w-9'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Character */}
          <div className="flex justify-center mb-6">
            <AnimatePresence mode="wait">
              <motion.img
                key={step}
                src={STEP_CHARACTERS[step]}
                alt="白くまキャラクター"
                className="w-32 drop-shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  opacity: { duration: 0.3 },
                  scale: { duration: 0.3 },
                  y: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
                }}
              />
            </AnimatePresence>
          </div>

          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-base font-bold text-gray-900 mb-2">
                組織名（会社名・チーム名）
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="例: 株式会社スリスタ"
                className="w-full px-4 py-3.5 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-base text-gray-900 shadow-sm"
                autoFocus
              />
              <motion.button
                onClick={() => orgName.trim() && setStep(1)}
                disabled={!orgName.trim()}
                whileTap={{ scale: 0.95 }}
                className="w-full mt-6 py-4 bg-blue-600 text-white text-base font-black rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                次へ
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-base font-bold text-gray-900 mb-2">業種</label>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {INDUSTRY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setIndustry(opt)}
                    className={`px-3 py-2.5 rounded-full text-base font-bold transition-all ${
                      industry === opt
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setStep(0)}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 text-base font-black rounded-full hover:bg-gray-200 transition-all"
                >
                  戻る
                </motion.button>
                <motion.button
                  onClick={() => setStep(2)}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-4 bg-blue-600 text-white text-base font-black rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                >
                  次へ
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <label className="block text-base font-bold text-gray-900 mb-2">従業員数</label>
              <div className="space-y-2 mb-6">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSize(opt.value)}
                    className={`w-full px-4 py-3.5 rounded-full text-base font-bold text-left transition-all ${
                      size === opt.value
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  onClick={() => setStep(1)}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 text-base font-black rounded-full hover:bg-gray-200 transition-all"
                >
                  戻る
                </motion.button>
                <motion.button
                  onClick={handleCreate}
                  disabled={loading}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-4 bg-blue-600 text-white text-base font-black rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50"
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
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
