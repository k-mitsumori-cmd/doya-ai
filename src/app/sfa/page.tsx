'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function SfaEntryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/sfa/usage', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.onboarded && d?.organization?.slug) {
          router.replace(`/sfa/${d.organization.slug}`)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/sfa/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/sfa/${d.organization.slug}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold">読み込み中…</div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-lime-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center text-3xl shadow-lg shadow-green-500/30 mx-auto mb-3">
            📈
          </div>
          <h1 className="text-2xl font-black text-slate-900">ドヤ営業管理へようこそ</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">組織を作成すると、すぐに使い始められます（サンプル付き）</p>
        </div>
        <label className="block text-sm font-black text-slate-700 mb-1">組織名（会社名）</label>
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="例: 株式会社スリスタ"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold mb-3"
        />
        <label className="block text-sm font-black text-slate-700 mb-1">あなたの氏名</label>
        <input
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          placeholder="例: 三森 律稀"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold mb-5"
        />
        <button
          onClick={create}
          disabled={creating}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black text-lg shadow-lg shadow-green-500/30 hover:shadow-xl transition-all disabled:opacity-50"
        >
          {creating ? '作成中…' : '🚀 組織を作成して始める'}
        </button>
      </div>
    </div>
  )
}
