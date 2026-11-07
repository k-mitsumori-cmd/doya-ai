'use client'

import { useCallback, useEffect, useState } from 'react'

interface Status {
  configured: boolean
  connection: { email: string; status: 'ACTIVE' | 'REVOKED'; connectedAt: string } | null
  dailyLimit: number
  sentToday: number
}

const NOTICE: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Gmail と連携しました。' },
  denied: { ok: false, text: '連携がキャンセルされました。' },
  state: { ok: false, text: '連携の確認に失敗しました。もう一度お試しください。' },
  token: { ok: false, text: 'Google からトークンを受け取れませんでした。もう一度お試しください。' },
  scope: { ok: false, text: 'メール送信の許可が選ばれていませんでした。同意画面で、メールの送信を許可してください。' },
  unconfigured: { ok: false, text: '連携の準備がまだ整っていません。管理者にお問い合わせください。' },
  unauthorized: { ok: false, text: 'ログインしてからお試しください。' },
}

export default function GmailConnectCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status', { cache: 'no-store' })
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const code = new URLSearchParams(window.location.search).get('gmail')
    if (code && NOTICE[code]) setNotice(NOTICE[code])
  }, [load])

  const disconnect = async () => {
    if (!window.confirm('Gmail との連携を解除します。Google 側の許可も取り消し、保存したトークンを削除します。よろしいですか。')) return
    setBusy(true)
    try {
      const res = await fetch('/api/gmail/disconnect', { method: 'POST' })
      setNotice(res.ok ? { ok: true, text: '連携を解除しました。' } : { ok: false, text: '解除に失敗しました。' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const conn = status?.connection
  const active = conn?.status === 'ACTIVE'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Gmail と連携</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        ご自身の Google アカウントと連携すると、作成したメール文を、ご自身の Gmail から送れます。
        許可するのはメールの送信だけです。受信箱の閲覧や、過去のメールの読み取りはできません。
        送信は、確認画面で送信ボタンを押したときだけ行われます。
      </p>

      {notice && (
        <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
          {notice.text}
        </p>
      )}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-slate-500">状態を確認しています。</p>
        ) : !status?.configured ? (
          <p className="text-sm text-slate-500">この環境では、Gmail 連携の準備がまだ整っていません。</p>
        ) : active ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-800">
              連携中のアドレス：<span className="font-bold">{conn!.email}</span>
            </p>
            <p className="text-xs text-slate-500">
              連携日：{new Date(conn!.connectedAt).toLocaleDateString('ja-JP')} ／ 本日の送信：{status.sentToday} 通（上限 {status.dailyLimit} 通）
            </p>
            <button onClick={disconnect} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              連携を解除する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {conn?.status === 'REVOKED' && (
              <p className="text-sm text-amber-800">以前の連携は Google 側で取り消されています。連携し直してください。</p>
            )}
            <a href="/api/gmail/connect" className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              Gmail と連携する
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
