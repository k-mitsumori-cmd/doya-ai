'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { deviceName, lastUsedText, revokeConfirmText, revokeErrorText, sortDevices, type DeviceItem } from '@/lib/auth-link/devices-view'

export default function DevicesPage() {
  const { status } = useSession()
  const [devices, setDevices] = useState<DeviceItem[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    const res = await fetch('/api/app/auth/devices', { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(revokeErrorText(res.status, j.code)); return }
    setDevices(sortDevices(j.devices as DeviceItem[]))
    setNow(new Date())
  }, [])

  useEffect(() => { if (status === 'authenticated') load().catch(() => setError('読み込めませんでした。しばらくしてからもう一度お試しください。')) }, [status, load])

  if (status === 'loading') return null
  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-700">ログイン中の端末の確認には、ログインが必要です。</p>
        <Link href="/auth/signin?callbackUrl=/settings/devices" className="mt-4 inline-block rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">ログインする</Link>
      </div>
    )
  }

  const revoke = async (d: DeviceItem) => {
    if (!confirm(revokeConfirmText(d))) return
    setBusyId(d.id); setError(null)
    const res = await fetch(`/api/app/auth/devices/${encodeURIComponent(d.id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(revokeErrorText(res.status, j.code))
    }
    await load().catch(() => {})
    setBusyId(null)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-black text-slate-900">ログイン中の端末</h1>
      <p className="mt-2 text-sm text-slate-600 [text-wrap:balance] [word-break:auto-phrase]">
        ドヤバディのアプリにログインしている端末の一覧です。<wbr />お心当たりのない端末があるときは、ログアウトしてください。
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {devices && devices.length === 0 && <p className="mt-6 text-sm text-slate-600">アプリにログインしている端末はありません。</p>}
      {devices && devices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">
                  {deviceName(d)}
                  {d.isCurrent && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">この端末</span>}
                </p>
                <p className="text-xs text-slate-500">{lastUsedText(d.lastUsedAt, now)}</p>
              </div>
              <button type="button" disabled={busyId !== null} onClick={() => revoke(d)}
                className="shrink-0 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-40">
                {d.isCurrent ? 'この端末からログアウトする' : 'ログアウトさせる'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
