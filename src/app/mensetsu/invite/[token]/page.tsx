'use client'

// ============================================
// ドヤ面接官 招待を受ける画面
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function MensetsuInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token as string

  const [invite, setInvite] = useState<{ organizationName: string; roleLabel: string; accepted: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ⚠️ ログイン状態で fetch をゲートしない（Cookie認証なので未確定でも応答する）
  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await fetch(`/api/mensetsu/invite/${token}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json?.error || '招待が見つかりません')
          return
        }
        setInvite(json.invite)
      } catch {
        setError('通信に失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const accept = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/invite/${token}`, { method: 'POST' })
      const json = await res.json()
      if (res.status === 401) {
        // 未ログインならログインへ送り、戻ってきたらこの画面に戻す
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/mensetsu/invite/${token}`)}`)
        return
      }
      if (!res.ok) {
        setError(json?.error || '参加できませんでした')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/mensetsu'), 1200)
    } finally {
      setBusy(false)
    }
  }, [router, token])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        {done ? (
          <>
            <span className="material-symbols-outlined text-4xl text-[#0066ff]">task_alt</span>
            <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">参加しました</h1>
            <p className="mt-2 text-sm font-medium text-[#425071]">面接の管理画面へ移動します…</p>
          </>
        ) : error ? (
          <>
            <span className="material-symbols-outlined text-4xl text-[#8a94ad]">error</span>
            <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">参加できません</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">{error}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-[#0066ff]">ドヤ面接官</p>
            <h1 className="mt-2 text-xl font-black leading-snug text-[#0a0f3c]">
              {invite?.organizationName} に招待されています
            </h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">
              権限: <strong className="font-black text-[#0a0f3c]">{invite?.roleLabel}</strong>
              <br />
              参加すると、この組織の面接テンプレートと応募者の記録を扱えるようになります。
            </p>
            <button
              onClick={accept}
              disabled={busy || !!invite?.accepted}
              className="mt-6 w-full rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white disabled:bg-[#b9cdf5]"
            >
              {invite?.accepted ? 'この招待は使用済みです' : busy ? '処理中…' : '参加する'}
            </button>
            <p className="mt-3 text-xs font-medium text-[#8a94ad]">
              ログインしていない場合は、参加を押すとログイン画面に移動します。
            </p>
          </>
        )}
      </div>
    </main>
  )
}
