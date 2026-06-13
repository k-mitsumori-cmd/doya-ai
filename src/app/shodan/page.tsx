'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

export default function ShodanEntryPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'guest' | 'onboard'>('loading')
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // Cookie認証なので useSession に依存せず /me を直接叩く
    fetch('/api/shodan/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.authenticated) { setPhase('guest'); return }
        if (d?.onboarded && d?.memberships?.[0]?.slug) {
          router.replace(`/shodan/${encodeURIComponent(d.memberships[0].slug)}`)
        } else {
          setPhase('onboard')
        }
      })
      .catch(() => setPhase('guest'))
  }, [router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/shodan/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      const d = await res.json()
      if (res.status === 401) { signIn('google', { callbackUrl: '/shodan' }); return }
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/shodan/${encodeURIComponent(d.organization.slug)}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold">読み込み中…</div>
  }

  if (phase === 'guest') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-fuchsia-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-2xl font-black text-slate-900">ドヤ商談準備</h1>
          <p className="text-slate-500 font-bold text-sm mt-2 mb-6">
            商談先のURLを入れるだけ。<br />リサーチ・課題仮説・提案資料まで一括で。
          </p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/shodan' })}
            className="w-full py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 font-black text-base shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Googleでログイン
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-fuchsia-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎯</div>
          <h2 className="text-xl font-black text-slate-900">ようこそ！</h2>
          <p className="text-slate-500 font-bold text-sm mt-1">組織を作成するとすぐに使い始められます</p>
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
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all disabled:opacity-50"
        >
          {creating ? '作成中…' : '🚀 組織を作成して始める'}
        </button>
      </div>
    </div>
  )
}
