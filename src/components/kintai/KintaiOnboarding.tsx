'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function KintaiOnboarding() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError('組織名を入力してください')
      return
    }
    if (!employeeName.trim()) {
      setError('氏名を入力してください')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/kintai/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), employeeName: employeeName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '組織の作成に失敗しました')
      }
      window.location.href = '/kintai/clock'
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 relative overflow-hidden">

      {/* ===== Floating Decorative Dots ===== */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="float-dot-1 absolute top-[20%] left-[10%] w-4 h-4 rounded-full bg-[#7f19e6]/10" />
        <div className="float-dot-2 absolute top-[15%] right-[12%] w-5 h-5 rounded-full bg-amber-300/15" />
        <div className="float-dot-1 absolute bottom-[25%] left-[15%] w-3 h-3 rounded-full bg-emerald-400/10" />
        <div className="float-dot-2 absolute bottom-[30%] right-[20%] w-4 h-4 rounded-full bg-rose-300/10" />
        <div className="float-dot-1 absolute top-[50%] right-[5%] w-3 h-3 rounded-full bg-[#7f19e6]/5" />
      </div>

      <div className="relative z-10 w-full max-w-md card-pop">
        {/* ===== Bear Character at Top ===== */}
        <div className="flex justify-center mb-[-20px] relative z-20">
          {loading ? (
            <img
              src="/kintai/characters/thinking_考え中.png"
              alt="考え中のクマ"
              className="bear-think-spin"
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          ) : error ? (
            <img
              src="/kintai/characters/error_泣き.png"
              alt="泣いているクマ"
              className="bear-error-shake"
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          ) : (
            <img
              src="/kintai/characters/hello_挨拶.png"
              alt="挨拶するクマ"
              className="bear-gentle-bounce bear-bounce-in"
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          )}
        </div>

        {/* ===== Card ===== */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-[#7f19e6]/8 border border-slate-200/80 overflow-hidden">
          <div className="p-8 pt-10">
            {/* ===== Header ===== */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#7f19e6]/5 rounded-full mb-4">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-sm">schedule</span>
                </div>
                <span className="text-xs font-bold text-[#7f19e6]">ドヤ勤怠</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">
                ドヤ勤怠へようこそ！
              </h1>
              <p className="text-sm text-slate-500">
                組織を作成して勤怠管理を始めましょう
              </p>
            </div>

            {/* ===== Form ===== */}
            <div className="space-y-5">
              <div className="fade-in-up" style={{ animationDelay: '0.1s' }}>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <span className="material-symbols-outlined text-sm align-middle mr-1 text-[#7f19e6]">apartment</span>
                  組織名（会社名・チーム名）
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="例: 株式会社スリスタ"
                  className="input-fancy w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 outline-none text-slate-900 transition-all bg-slate-50/50 focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <span className="material-symbols-outlined text-sm align-middle mr-1 text-[#7f19e6]">person</span>
                  あなたの氏名
                </label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="例: 田中 太郎"
                  className="input-fancy w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 outline-none text-slate-900 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* ===== Error ===== */}
            {error && (
              <div className="mt-5 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3">
                <img
                  src="/kintai/characters/error_泣き.png"
                  alt="エラー"
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
                />
                <p className="text-sm text-red-600 font-bold">{error}</p>
              </div>
            )}

            {/* ===== Submit Button ===== */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="btn-glow w-full mt-7 py-4 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold text-lg rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-[0.97]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <img
                    src="/kintai/characters/thinking_考え中.png"
                    alt="考え中"
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                  />
                  作成中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">rocket_launch</span>
                  組織を作成
                </span>
              )}
            </button>

            {/* ===== Subtle bottom text ===== */}
            <p className="text-center text-xs text-slate-400 mt-4">
              すぐに使い始められます。クレジットカード不要。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
