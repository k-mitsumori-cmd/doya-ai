'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useSession, signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

export default function SfaEntryPage() {
  const router = useRouter()
  const { status } = useSession()
  const [checking, setChecking] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // 認証状態が確定するまで待つ
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      setChecking(false)
      return
    }
    // ログイン済み → 既に組織があればリダイレクト、無ければ作成フォーム
    fetch('/api/sfa/usage', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.onboarded && d?.organization?.slug) {
          router.replace(`/sfa/${d.organization.slug}`)
        } else if (d?.memberships?.length) {
          // 既に所属組織がある場合は組織作成フォームを出さず、その組織へ
          router.replace(`/sfa/${d.memberships[0].slug}`)
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [status, router])

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
      if (res.status === 401) {
        signIn('google', { callbackUrl: '/sfa' })
        return
      }
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/sfa/${d.organization.slug}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold">読み込み中…</div>
    )
  }

  // 未ログイン → Googleログイン導線
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-lime-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <Image
            src="/sfa/logo.png"
            alt="ドヤ営業管理"
            width={2016}
            height={864}
            priority
            className="w-full h-auto rounded-2xl shadow-md mb-4"
          />
          <p className="text-slate-500 font-bold text-sm mt-1 mb-6">
            商談パイプライン・取引先管理を、ログインするだけですぐ開始できます
          </p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/sfa' })}
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
          <p className="text-[11px] text-slate-400 font-bold mt-4">ログイン後、組織を作成すればサンプル付きで利用開始できます</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-lime-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Image
            src="/sfa/logo.png"
            alt="ドヤ営業管理"
            width={2016}
            height={864}
            priority
            className="w-full h-auto rounded-2xl shadow-md mb-3"
          />
          <h2 className="text-xl font-black text-slate-900">ようこそ！</h2>
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
