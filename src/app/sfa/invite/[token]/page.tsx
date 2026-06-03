'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

export default function SfaInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { status } = useSession()
  const [info, setInfo] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/sfa/invite/${token}`, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setInfo(d) : setErr(d.error || '招待が無効です')))
      .catch(() => setErr('招待の確認に失敗しました'))
  }, [token])

  const accept = async () => {
    if (status !== 'authenticated') {
      signIn(undefined, { callbackUrl: `/sfa/invite/${token}` })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/sfa/invite/${token}`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('参加しました！')
      router.replace(`/sfa/${d.organizationSlug}`)
    } catch (e: any) {
      toast.error(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-lime-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center text-3xl shadow-lg mx-auto mb-4">📈</div>
        {err ? (
          <p className="font-black text-slate-700">{err}</p>
        ) : !info ? (
          <p className="text-slate-400 font-bold">確認中…</p>
        ) : (
          <>
            <h1 className="text-xl font-black text-slate-900">「{info.organizationName}」への招待</h1>
            <p className="text-slate-500 font-bold text-sm mt-2 mb-6">
              ドヤ営業管理のメンバーとして参加します（{info.email}）
            </p>
            <button
              onClick={accept}
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black text-lg shadow-lg disabled:opacity-50"
            >
              {busy ? '参加中…' : status === 'authenticated' ? '招待を受けて参加する' : 'ログインして参加する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
