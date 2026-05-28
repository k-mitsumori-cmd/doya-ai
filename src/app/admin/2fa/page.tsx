'use client'

import { useEffect, useState } from 'react'
import { Shield, Smartphone, Check, AlertTriangle, Copy } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function Admin2FAPage() {
  const [enabled, setEnabled] = useState(false)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle')
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/2fa/status', { credentials: 'include' })
      const data = await res.json()
      setEnabled(data.enabled || false)
      setUsername(data.username || '')
    } catch {
      toast.error('ステータス取得に失敗しました', { id: '2fa-status-err' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const startSetup = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/2fa/setup', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSecret(data.secret)
      setQrDataUrl(data.qrDataUrl)
      setStep('verify')
    } catch (e: any) {
      toast.error(e.message || 'セットアップに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const verifyAndEnable = async () => {
    if (code.length !== 6) {
      toast.error('6桁のコードを入力してください')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('2要素認証を有効化しました 🎉')
      setEnabled(true)
      setStep('idle')
      setCode('')
      setSecret('')
      setQrDataUrl('')
    } catch (e: any) {
      toast.error(e.message || '検証に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const disable2FA = async () => {
    if (code.length !== 6) {
      toast.error('6桁のコードを入力してください')
      return
    }
    if (!confirm('本当に2要素認証を無効化しますか？セキュリティが低下します。')) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('2要素認証を無効化しました')
      setEnabled(false)
      setStep('idle')
      setCode('')
    } catch (e: any) {
      toast.error(e.message || '無効化に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="w-7 h-7 text-violet-400" />
          2要素認証 (2FA)
        </h1>
        <p className="text-sm text-white/40 mt-1">
          管理者: <span className="text-violet-400 font-bold">{username}</span>
        </p>
      </div>

      {/* Current status */}
      <div className={`rounded-2xl border p-5 ${enabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <div className="flex items-center gap-3">
          {enabled ? <Check className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-amber-400" />}
          <div>
            <p className={`font-bold ${enabled ? 'text-emerald-300' : 'text-amber-300'}`}>
              {enabled ? '2要素認証は有効です' : '2要素認証が無効です'}
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              {enabled ? 'ログイン時に認証アプリのコードが必要です' : 'パスワードのみでログイン可能（推奨: 有効化）'}
            </p>
          </div>
        </div>
      </div>

      {/* Setup / Disable */}
      {!enabled && step === 'idle' && (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">2要素認証を有効にする</h2>
            <p className="text-sm text-white/50">
              Google Authenticator / 1Password / Authy 等の認証アプリを使ってアカウントを保護します。
            </p>
          </div>
          <button
            onClick={startSetup}
            disabled={busy}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Smartphone className="w-5 h-5 inline mr-2" />
            セットアップを開始
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">QRコードをスキャン</h2>
            <p className="text-sm text-white/50">認証アプリでこのQRコードをスキャンしてください。</p>
          </div>

          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="2FA QR Code" className="w-56 h-56 bg-white rounded-xl p-2" />
            </div>
          )}

          <div>
            <p className="text-xs text-white/40 mb-2">手動入力用シークレット:</p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-black/30 text-violet-300 font-mono text-sm rounded-lg break-all">
                {secret}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(secret); toast.success('コピーしました') }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg"
                aria-label="シークレットをコピー"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">認証アプリに表示された6桁のコードを入力</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              autoFocus
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('idle'); setCode(''); setSecret(''); setQrDataUrl('') }}
              disabled={busy}
              className="flex-1 py-3 bg-white/5 text-white/60 font-bold rounded-xl hover:bg-white/10"
            >
              キャンセル
            </button>
            <button
              onClick={verifyAndEnable}
              disabled={busy || code.length !== 6}
              className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? '検証中...' : '有効化する'}
            </button>
          </div>
        </div>
      )}

      {enabled && step === 'idle' && (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
          <button
            onClick={() => setStep('disable')}
            className="text-sm text-red-400 hover:text-red-300"
          >
            2要素認証を無効化する →
          </button>
        </div>
      )}

      {step === 'disable' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-red-400 mb-2">2要素認証を無効化</h2>
            <p className="text-sm text-white/60">
              無効化するには、現在の認証コードを入力してください。
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            autoFocus
            className="w-full px-4 py-3 bg-black/30 border border-red-500/30 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('idle'); setCode('') }}
              disabled={busy}
              className="flex-1 py-3 bg-white/5 text-white/60 font-bold rounded-xl hover:bg-white/10"
            >
              キャンセル
            </button>
            <button
              onClick={disable2FA}
              disabled={busy || code.length !== 6}
              className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
            >
              {busy ? '処理中...' : '無効化する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
