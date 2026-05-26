'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

type InviteStatus = 'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'expired'

export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [status, setStatus] = useState<InviteStatus>('loading')
  const [orgName, setOrgName] = useState('')
  const [inviterName, setInviterName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    async function verifyInvite() {
      try {
        const res = await fetch(`/api/hr/organization/invite/${token}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (res.status === 410 || data.expired) {
            setStatus('expired')
          } else {
            setError(data.error || '招待の検証に失敗しました')
            setStatus('error')
          }
          return
        }
        const data = await res.json()
        setOrgName(data.organizationName || data.orgName || '')
        setInviterName(data.inviterName || data.invitedBy || '')
        setStatus('ready')
      } catch {
        setError('招待の検証に失敗しました')
        setStatus('error')
      }
    }
    verifyInvite()
  }, [token])

  const handleAccept = async () => {
    setStatus('accepting')
    try {
      const res = await fetch(`/api/hr/organization/invite/${token}/accept`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '招待の受諾に失敗しました')
      }
      setStatus('success')
      setTimeout(() => {
        router.push('/hr/dashboard')
      }, 3000)
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
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
                src="/hr/characters/hello_挨拶.png"
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
              <motion.button
                onClick={handleAccept}
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
                src="/hr/characters/working_作業中.png"
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
                src="/hr/characters/jump_大喜び.png"
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
                src="/hr/characters/error_泣き.png"
                alt="白くまキャラクター"
                className="w-28 mx-auto mb-4"
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <h2 className="text-xl font-black text-red-600 mb-2">エラーが発生しました</h2>
              <p className="text-sm text-slate-500 mb-6">{error}</p>
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
                src="/hr/characters/sleep_居眠り.png"
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
