'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { NavigationSubmissionError, startGoogleSignIn, switchGoogleAccount, useNavigationSubmission } from '@/lib/use-navigation-submission'

type InviteStatus = 'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'expired'

export default function InviteAcceptPage() {
  const params = useParams()
  const token = params?.token as string
  return <InviteContent key={token} token={token} />
}

function InviteContent({ token }: { token: string }) {
  const router = useRouter()

  const [status, setStatus] = useState<InviteStatus>('loading')
  const [orgName, setOrgName] = useState('')
  const [inviterName, setInviterName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState('')
  const [verificationRevision, setVerificationRevision] = useState(0)
  const [accountAction, setAccountAction] = useState<'signIn' | 'switch' | null>(null)
  const callbackUrl = `/hr/invite/${encodeURIComponent(token || '')}`

  const { busy: accountBusy, run: submitAccount } = useNavigationSubmission('ログインを開始できませんでした。もう一度お試しください。')
  const { busy: acceptanceBusy, run: submitAcceptance } = useNavigationSubmission('招待を受諾できませんでした。もう一度お試しください。')

  useEffect(() => {
    if (!token) { setError('招待が見つかりません'); setStatus('error'); return }
    let active = true
    const controller = new AbortController()
    async function verifyInvite() {
      try {
        const res = await fetch(`/api/hr/organization/invite/${encodeURIComponent(token)}`, { cache: 'no-store', signal: controller.signal })
        if (!active) return
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (!active) return
          if (res.status === 410 || data.expired) {
            setStatus('expired')
          } else {
            setError(typeof data.error === 'string' ? data.error : '招待の検証に失敗しました')
            setStatus('error')
          }
          return
        }
        const data = await res.json()
        if (!active) return
        const inv = data.invitation || data
        if (!inv || typeof inv.status !== 'string' || typeof inv.organization?.id !== 'string' || !inv.organization.id || typeof inv.organization.name !== 'string' || typeof inv.email !== 'string' || !inv.email) throw new Error('Invalid invitation response')
        setOrgName(inv.organization?.name || inv.organizationName || inv.orgName || '')
        setInviterName(typeof inv.inviterName === 'string' ? inv.inviterName : typeof inv.invitedBy === 'string' ? inv.invitedBy : '')
        setInviteEmail(inv.email || '')
        if (inv.status === 'EXPIRED') {
          setStatus('expired')
          return
        }
        if (inv.status !== 'PENDING') {
          setError(inv.status === 'CANCELLED' ? 'この招待はキャンセルされています。管理者に再送を依頼してください。' : 'この招待は既に使用済みです')
          setStatus('error')
          return
        }
        setStatus('ready')
      } catch {
        if (!active) return
        setError('招待の検証に失敗しました')
        setStatus('error')
      }
    }
    verifyInvite()
    return () => { active = false; controller.abort() }
  }, [token, verificationRevision])

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => router.push('/hr/dashboard'), 3000)
    return () => clearTimeout(timer)
  }, [status, router])

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setStatus(current => current === 'accepting' ? 'ready' : current)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  const verifyAgain = () => {
    if (status !== 'error' || accountBusy || acceptanceBusy) return
    setStatus('loading')
    setAccountAction(null)
    setError('')
    setVerificationRevision(current => current + 1)
  }

  const handleAccount = async () => {
    if (!accountAction || status !== 'error') return
    await submitAccount(async () => {
      if (accountAction === 'switch') await switchGoogleAccount(callbackUrl)
      else await startGoogleSignIn(callbackUrl)
    })
  }

  const handleAccept = async () => {
    if (status !== 'ready') return
    await submitAcceptance(async (isCurrent) => {
      setStatus('accepting')
      setAccountAction(null)
      let expired = false
      try {
        const res = await fetch('/api/hr/organization/invite/accept', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
        })
        if (!isCurrent()) return
        if (res.status === 401) {
          setAccountAction('signIn')
          throw new NavigationSubmissionError('招待されたメールアドレスでログインしてください。')
        }
        if (res.status === 410) {
          expired = true
          setStatus('expired')
          throw new NavigationSubmissionError('招待の有効期限が切れています。管理者に再送を依頼してください。')
        }
        const data = await res.json()
        if (!isCurrent()) return
        if (!res.ok) {
          if (res.status === 403 && data.code === 'INVITE_EMAIL_MISMATCH') setAccountAction('switch')
          throw new NavigationSubmissionError(typeof data.error === 'string' ? data.error : '招待を受諾できませんでした。')
        }
        if (data.success !== true || typeof data.organization?.id !== 'string' || !data.organization.id) throw new Error('Invalid participation response')
        setStatus('success')
      } catch (failure) {
        if (!isCurrent()) return
        const message = failure instanceof NavigationSubmissionError ? failure.message : '招待を受諾できませんでした。もう一度お試しください。'
        if (!expired) setStatus('error')
        setError(message)
        throw new NavigationSubmissionError(message)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center"
      >
        <AnimatePresence mode="wait">
          {/* Loading */}
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-6 w-48 bg-slate-100 rounded-full mx-auto mb-3 animate-pulse" />
              <div className="h-4 w-64 bg-slate-50 rounded-full mx-auto animate-pulse" />
            </motion.div>
          )}

          {/* Ready */}
          {status === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <motion.img
                src="/hr/characters/hello_%E6%8C%A8%E6%8B%B6.png"
                alt="白くまキャラクター"
                className="w-32 mx-auto mb-4 drop-shadow-lg"
                animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              />
              <h1 className="text-2xl font-black text-slate-900 mb-2">招待が届いています!</h1>
              {orgName && (
                <p className="text-lg font-bold text-blue-600 mb-1">{orgName}</p>
              )}
              {inviterName && (
                <p className="text-sm text-slate-500 mb-6">
                  {inviterName} さんからの招待です
                </p>
              )}
              {inviteEmail && (
                <p className="text-sm text-slate-600 mb-4 break-all">
                  招待先: <span className="font-bold">{inviteEmail}</span>
                </p>
              )}
              <motion.button
                onClick={handleAccept}
                disabled={acceptanceBusy}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-blue-600 text-white rounded-full text-lg font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-xl transition-all"
              >
                <span className="material-symbols-outlined text-xl align-middle mr-2">check_circle</span>
                招待を受ける
              </motion.button>
              <p className="text-xs text-slate-400 mt-4">
                受諾すると組織のメンバーとして登録されます
              </p>
            </motion.div>
          )}

          {/* Accepting */}
          {status === 'accepting' && (
            <motion.div
              key="accepting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.img
                src="/hr/characters/working_%E4%BD%9C%E6%A5%AD%E4%B8%AD.png"
                alt="白くまキャラクター"
                className="w-28 mx-auto mb-4"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <p className="text-lg font-bold text-slate-700">参加手続き中...</p>
              <div className="w-48 h-2 bg-slate-100 rounded-full mx-auto mt-4 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* Success */}
          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            >
              <motion.img
                src="/hr/characters/jump_%E5%A4%A7%E5%96%9C%E3%81%B3.png"
                alt="白くまキャラクター"
                className="w-36 mx-auto mb-4 drop-shadow-lg"
                animate={{
                  y: [0, -30, 0, -15, 0],
                  rotate: [0, -5, 5, -3, 0],
                }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-black text-emerald-600 mb-2">
                  参加完了!
                </h2>
                {orgName && (
                  <p className="text-base text-slate-600 mb-2">
                    <span className="font-bold">{orgName}</span> へようこそ!
                  </p>
                )}
                <p className="text-sm text-slate-500">
                  ダッシュボードに移動します...
                </p>
              </motion.div>

              {/* Confetti-like particles */}
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6],
                    left: `${20 + Math.random() * 60}%`,
                    top: '40%',
                  }}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{
                    opacity: 0,
                    y: -80 - Math.random() * 120,
                    x: (Math.random() - 0.5) * 200,
                    scale: 0,
                    rotate: Math.random() * 360,
                  }}
                  transition={{ duration: 1.5, delay: 0.1 * i, ease: 'easeOut' }}
                />
              ))}
            </motion.div>
          )}

          {/* Error */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.img
                src="/hr/characters/error_%E6%B3%A3%E3%81%8D.png"
                alt="白くまキャラクター"
                className="w-28 mx-auto mb-4"
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <h2 className="text-xl font-black text-red-600 mb-2">エラーが発生しました</h2>
              <p className="text-sm text-slate-500 mb-6">{error}</p>
              {accountAction && (
                <button
                  onClick={handleAccount}
                  disabled={accountBusy}
                  className="w-full mb-3 px-6 py-3 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  {accountBusy ? 'ログイン処理中…' : accountAction === 'switch' ? '別のアカウントでログイン' : 'Googleでログイン'}
                </button>
              )}
              <button
                onClick={verifyAgain}
                disabled={accountBusy || acceptanceBusy}
                className="w-full mb-3 px-6 py-3 bg-blue-50 text-blue-700 rounded-full text-sm font-bold disabled:opacity-50"
              >
                招待の状態を再確認
              </button>
              <button
                onClick={() => router.push('/hr/dashboard')}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-full text-sm font-bold hover:bg-slate-200 transition-all"
              >
                ダッシュボードへ戻る
              </button>
            </motion.div>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <motion.div
              key="expired"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.img
                src="/hr/characters/sleep_%E5%B1%85%E7%9C%A0%E3%82%8A.png"
                alt="白くまキャラクター"
                className="w-28 mx-auto mb-4"
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
              />
              <h2 className="text-xl font-black text-amber-600 mb-2">招待の有効期限切れ</h2>
              <p className="text-sm text-slate-500 mb-6">
                この招待リンクは期限切れです。管理者に再送を依頼してください。
              </p>
              <button
                onClick={() => router.push('/hr/dashboard')}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-full text-sm font-bold hover:bg-slate-200 transition-all"
              >
                ダッシュボードへ戻る
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
