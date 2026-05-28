'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/kintai/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setInvite(data)
      })
      .catch(() => setError('招待情報の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleJoin() {
    if (!session?.user) {
      window.location.href = `/auth/signin?callbackUrl=/kintai/invite/${token}`
      return
    }
    setJoining(true)
    try {
      const res = await fetch(`/api/kintai/invite/${token}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/kintai/clock'
      } else {
        setError(data.error || '参加に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50">
        <div className="text-center">
          <img src="/kintai/characters/thinking_考え中.png" alt="" className="w-24 h-24 mx-auto animate-bounce" style={{ objectFit: 'contain' }} />
          <p className="mt-4 text-lg font-bold text-slate-500">招待情報を確認中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <img src="/kintai/characters/error_泣き.png" alt="" className="w-24 h-24 mx-auto mb-4" style={{ objectFit: 'contain' }} />
          <h1 className="text-2xl font-black text-slate-900 mb-2">招待エラー</h1>
          <p className="text-base font-bold text-slate-500 mb-6">{error}</p>
          <a href="/kintai" className="inline-flex items-center gap-2 px-8 py-3 bg-[#7f19e6] text-white font-bold rounded-full hover:bg-[#6a14c2] transition-all shadow-lg">
            トップに戻る
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
        <img src="/kintai/characters/hello_挨拶.png" alt="" className="w-28 h-28 mx-auto mb-4" style={{ objectFit: 'contain' }} />
        <h1 className="text-2xl font-black text-slate-900 mb-2">招待が届いています！</h1>
        <div className="bg-purple-50 rounded-2xl p-5 mb-6">
          <p className="text-lg font-black text-[#7f19e6] mb-1">{invite?.organizationName}</p>
          <p className="text-base font-bold text-slate-600">{invite?.employeeName || 'メンバー'} として参加</p>
          {invite?.email && <p className="text-sm text-slate-400 mt-1">{invite.email}</p>}
        </div>
        {!session?.user ? (
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/kintai/invite/${token}`)}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-black text-lg rounded-full hover:shadow-xl transition-all shadow-lg w-full justify-center"
          >
            Googleでログインして参加
          </a>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-black text-lg rounded-full hover:shadow-xl transition-all shadow-lg w-full justify-center disabled:opacity-50"
          >
            {joining ? '参加中...' : '組織に参加する 🎉'}
          </button>
        )}
      </div>
    </div>
  )
}
