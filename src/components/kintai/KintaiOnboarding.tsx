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
      router.refresh()
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-lg shadow-[#7f19e6]/20">
              <span className="material-symbols-outlined text-2xl">schedule</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">ドヤ勤怠へようこそ</h1>
              <p className="text-sm text-slate-500">組織を作成して勤怠管理を始めましょう</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                組織名（会社名・チーム名）
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="例: 株式会社スリスタ"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#7f19e6] focus:ring-2 focus:ring-[#7f19e6]/20 outline-none text-slate-900"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                あなたの氏名
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="例: 田中 太郎"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#7f19e6] focus:ring-2 focus:ring-[#7f19e6]/20 outline-none text-slate-900"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full mt-6 py-3 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#7f19e6]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  )
}
