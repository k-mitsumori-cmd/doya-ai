'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'

// ============================================
// 型定義
// ============================================
interface UsageData {
  generationsThisMonth: number
  generationsLimit: number
  tokensUsed: number
  projectCount: number
  resetDate: string
}

// ============================================
// Toggle Switch
// ============================================
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-blue-500' : 'bg-slate-200'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}

// ============================================
// Settings Page
// ============================================
export default function SettingsPage() {
  const { data: session } = useSession()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(true)
  const [apiKeyRegenConfirm, setApiKeyRegenConfirm] = useState(false)
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // APIキー管理
  const [apiKeyInfo, setApiKeyInfo] = useState<{
    maskedKey: string
    createdAt: string
    lastUsedAt: string | null
  } | null>(null)
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null)
  const [loadingApiKey, setLoadingApiKey] = useState(false)

  // プロフィール保存
  const [profileName, setProfileName] = useState(session?.user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileToast, setProfileToast] = useState<string | null>(null)

  // 通知設定（localStorageから復元）
  const [notifyGenComplete, setNotifyGenComplete] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem('tenkai_notify_genComplete')
      return saved !== null ? JSON.parse(saved) === true : true
    } catch { return true }
  })
  const [notifyWeeklyReport, setNotifyWeeklyReport] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem('tenkai_notify_weeklyReport')
      return saved !== null ? JSON.parse(saved) === true : true
    } catch { return true }
  })
  const [notifyProduct, setNotifyProduct] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = localStorage.getItem('tenkai_notify_product')
      return saved !== null ? JSON.parse(saved) === true : false
    } catch { return false }
  })

  const plan = session?.user?.plan || 'FREE'
  const planLabel = plan === 'PRO' ? 'Pro' : plan === 'STARTER' ? 'Starter' : plan === 'ENTERPRISE' ? 'Enterprise' : plan === 'PREMIUM' ? 'Premium' : 'Free'
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE' || plan === 'PREMIUM'

  // ============================================
  // 利用状況取得
  // ============================================
  const fetchUsage = useCallback(async () => {
    try {
      setLoadingUsage(true)
      const res = await fetch('/api/tenkai/usage')
      if (!res.ok) throw new Error('利用状況の取得に失敗しました')
      const data = await res.json()
      setUsage({
        generationsThisMonth: data.usage?.creditsUsed ?? 0,
        generationsLimit: data.usage?.creditsLimit ?? data.limits?.monthlyCredits ?? 10,
        tokensUsed: data.usage?.tokensTotal ?? 0,
        projectCount: data.stats?.totalProjects ?? 0,
        resetDate: data.yearMonth ? `${data.yearMonth}-01` : '',
      })
    } catch {
      // Use fallback data
      setUsage({
        generationsThisMonth: 0,
        generationsLimit: 10,
        tokensUsed: 0,
        projectCount: 0,
        resetDate: '',
      })
    } finally {
      setLoadingUsage(false)
    }
  }, [])

  // ============================================
  // APIキー情報取得
  // ============================================
  const fetchApiKey = useCallback(async () => {
    if (!isPro) return
    try {
      setLoadingApiKey(true)
      const res = await fetch('/api/tenkai/api-key')
      if (!res.ok) return
      const data = await res.json()
      if (data.apiKey) {
        setApiKeyInfo({
          maskedKey: data.apiKey.maskedKey,
          createdAt: data.apiKey.createdAt,
          lastUsedAt: data.apiKey.lastUsedAt,
        })
      }
    } catch {
      // APIキー取得失敗は致命的ではない
    } finally {
      setLoadingApiKey(false)
    }
  }, [isPro])

  useEffect(() => {
    fetchUsage()
    fetchApiKey()
  }, [fetchUsage, fetchApiKey])

  // セッションからプロフィール名を同期
  useEffect(() => {
    if (session?.user?.name) {
      setProfileName(session.user.name)
    }
  }, [session?.user?.name])

  // ============================================
  // プロフィール更新
  // ============================================
  const handleProfileUpdate = async () => {
    const trimmedName = profileName.trim()
    if (!trimmedName) return
    try {
      setSavingProfile(true)
      const res = await fetch('/api/tenkai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'プロフィールの更新に失敗しました' }))
        setProfileToast(err.error || 'プロフィールの更新に失敗しました')
      } else {
        setProfileToast('設定を保存しました')
      }
    } catch {
      setProfileToast('ネットワークエラーが発生しました')
    } finally {
      setSavingProfile(false)
      setTimeout(() => setProfileToast(null), 3000)
    }
  }

  // ============================================
  // 通知設定のlocalStorage永続化
  // ============================================
  const handleNotifyGenComplete = (val: boolean) => {
    setNotifyGenComplete(val)
    localStorage.setItem('tenkai_notify_genComplete', JSON.stringify(val))
  }
  const handleNotifyWeeklyReport = (val: boolean) => {
    setNotifyWeeklyReport(val)
    localStorage.setItem('tenkai_notify_weeklyReport', JSON.stringify(val))
  }
  const handleNotifyProduct = (val: boolean) => {
    setNotifyProduct(val)
    localStorage.setItem('tenkai_notify_product', JSON.stringify(val))
  }

  const usagePercent = usage
    ? Math.min((usage.generationsThisMonth / usage.generationsLimit) * 100, 100)
    : 0

  // ============================================
  // データエクスポート
  // ============================================
  const handleExportData = async () => {
    try {
      setExporting(true)
      const res = await fetch('/api/tenkai/export')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'エクスポートに失敗しました' }))
        alert(err.error || 'エクスポートに失敗しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `doya-tenkai-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('エクスポートに失敗しました。もう一度お試しください。')
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // APIキー再生成
  // ============================================
  const handleRegenerateApiKey = async () => {
    try {
      setRegenerating(true)
      const res = await fetch('/api/tenkai/api-key', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'APIキー生成に失敗しました' }))
        alert(err.error || 'APIキー生成に失敗しました')
        return
      }
      const data = await res.json()
      setNewlyGeneratedKey(data.apiKey)
      setApiKeyInfo({
        maskedKey: `${data.prefix}${'•'.repeat(52)}`,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      })
      alert('新しいAPIキーが生成されました。このキーは一度しか表示されません。安全な場所にコピーしてください。')
    } catch {
      alert('APIキー生成に失敗しました。もう一度お試しください。')
    } finally {
      setRegenerating(false)
      setApiKeyRegenConfirm(false)
    }
  }

  // ============================================
  // アカウント削除
  // ============================================
  const handleDeleteAccount = async () => {
    try {
      setDeleting(true)
      const res = await fetch('/api/tenkai/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDelete: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'データ削除に失敗しました' }))
        alert(err.error || 'データ削除に失敗しました')
        return
      }
      const data = await res.json()
      alert(`展開AIのすべてのデータを削除しました。\nプロジェクト: ${data.deleted?.projects ?? 0}件\n出力: ${data.deleted?.outputs ?? 0}件`)
      // 利用状況を再取得
      fetchUsage()
    } catch {
      alert('データ削除に失敗しました。もう一度お試しください。')
    } finally {
      setDeleting(false)
      setDeleteAccountConfirm(false)
    }
  }

  // ============================================
  // トークン数フォーマット
  // ============================================
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return String(tokens)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Header ======== */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 className="text-2xl font-bold text-slate-900">アカウント設定</h1>
          <p className="text-sm text-slate-500 mt-1">プロフィール、利用状況、通知設定を管理</p>
        </div>
      </div>

      {/* ======== Content ======== */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ============ 1. プロフィール ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">person</span>
            プロフィール
          </h2>

          <div className="flex items-start gap-6">
            {/* アバター */}
            <div className="flex-shrink-0">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Avatar"
                  className="w-16 h-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
                  {session?.user?.name?.[0] || 'U'}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">名前</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  メールアドレス
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={session?.user?.email || ''}
                    readOnly
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
                  />
                  <span className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-400">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    Google連携
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
            {profileToast && (
              <span className="text-sm font-semibold text-emerald-600 animate-pulse">
                {profileToast}
              </span>
            )}
            <button
              onClick={handleProfileUpdate}
              disabled={savingProfile || !profileName.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingProfile ? '保存中...' : 'プロフィールを更新'}
            </button>
          </div>
        </motion.div>

        {/* ============ 2. 利用状況 ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">bar_chart</span>
            利用状況
          </h2>

          {loadingUsage ? (
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-16 bg-slate-100 rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* メイン: 生成回数 */}
              <div className="bg-slate-50 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">今月の生成回数</span>
                  <span className="text-lg font-extrabold text-blue-600">
                    {usage?.generationsThisMonth ?? 0}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      / {usage?.generationsLimit ?? 10} 回
                    </span>
                  </span>
                </div>

                {/* プログレスバー */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      usagePercent >= 90
                        ? 'bg-gradient-to-r from-red-400 to-red-500'
                        : usagePercent >= 70
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    }`}
                  />
                </div>

                <p className="text-xs text-slate-400">
                  {usage?.resetDate
                    ? `月末リセット: ${new Date(usage.resetDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}`
                    : '毎月1日にリセットされます'}
                </p>
              </div>

              {/* サブ統計 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    トークン使用量
                  </p>
                  <p className="text-xl font-extrabold text-slate-900">
                    {formatTokens(usage?.tokensUsed ?? 0)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    プロジェクト数
                  </p>
                  <p className="text-xl font-extrabold text-slate-900">
                    {usage?.projectCount ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    残り回数
                  </p>
                  <p className="text-xl font-extrabold text-emerald-600">
                    {Math.max(0, (usage?.generationsLimit ?? 10) - (usage?.generationsThisMonth ?? 0))}
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* ============ 3. プラン情報 ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">workspace_premium</span>
            プラン情報
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-2xl">diamond</span>
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{planLabel} プラン</p>
                <p className="text-xs text-slate-400">
                  {plan === 'FREE'
                    ? '月10回まで無料でご利用可能'
                    : plan === 'STARTER'
                    ? '月50回・全9プラットフォーム対応'
                    : plan === 'PRO'
                    ? '月200回・API対応・優先サポート'
                    : '無制限・チーム管理対応'}
                </p>
              </div>
            </div>
            <Link
              href="/tenkai/pricing"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base">upgrade</span>
              {plan === 'FREE' ? 'アップグレード' : 'プラン変更'}
            </Link>
          </div>
        </motion.div>

        {/* ============ 4. 通知設定 ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">notifications</span>
            通知設定
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">生成完了通知</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  コンテンツの生成が完了した時にメールでお知らせ
                </p>
              </div>
              <Toggle checked={notifyGenComplete} onChange={handleNotifyGenComplete} />
            </div>

            <div className="border-t border-slate-100" />

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">週次レポート</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  毎週月曜日に利用状況レポートをメールで送信
                </p>
              </div>
              <Toggle checked={notifyWeeklyReport} onChange={handleNotifyWeeklyReport} />
            </div>

            <div className="border-t border-slate-100" />

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">製品アップデート</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  新機能や改善のお知らせを受け取る
                </p>
              </div>
              <Toggle checked={notifyProduct} onChange={handleNotifyProduct} />
            </div>
          </div>
        </motion.div>

        {/* ============ 5. API設定 ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">api</span>
            API設定
            {!isPro && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                Pro以上
              </span>
            )}
          </h2>

          {isPro ? (
            <div className="space-y-4">
              {loadingApiKey ? (
                <div className="animate-pulse h-12 bg-slate-100 rounded-xl" />
              ) : newlyGeneratedKey ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    新しいAPIキー（一度しか表示されません）
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 font-mono text-sm text-slate-800 truncate">
                      {newlyGeneratedKey}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newlyGeneratedKey).then(() => {
                          alert('APIキーをクリップボードにコピーしました')
                        }).catch(() => {
                          alert('コピーに失敗しました。手動でコピーしてください。')
                        })
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">content_copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    このキーを安全な場所に保存してください。ページを離れると再表示できません。
                  </p>
                </div>
              ) : apiKeyInfo ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">APIキー</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm text-slate-600 truncate">
                      {apiKeyInfo.maskedKey}
                    </div>
                  </div>
                  {apiKeyInfo.lastUsedAt && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      最終使用: {new Date(apiKeyInfo.lastUsedAt).toLocaleString('ja-JP')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500 mb-2">APIキーがまだ生成されていません</p>
                  <p className="text-xs text-slate-400">
                    下のボタンからAPIキーを生成してください
                  </p>
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setApiKeyRegenConfirm(true)}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">autorenew</span>
                  {apiKeyInfo ? 'APIキーを再生成' : 'APIキーを生成'}
                </button>

                {apiKeyRegenConfirm && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setApiKeyRegenConfirm(false)}
                    />
                    <div className="absolute left-0 top-12 z-20 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-4">
                      <p className="text-sm font-semibold text-slate-900 mb-1">
                        {apiKeyInfo ? 'APIキーを再生成しますか？' : 'APIキーを生成しますか？'}
                      </p>
                      <p className="text-xs text-slate-400 mb-3">
                        {apiKeyInfo
                          ? '現在のキーは無効になります。連携中のシステムも更新が必要です。'
                          : '新しいAPIキーを生成します。'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setApiKeyRegenConfirm(false)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleRegenerateApiKey}
                          disabled={regenerating}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          {regenerating ? '生成中...' : apiKeyInfo ? '再生成' : '生成'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">lock</span>
              <p className="text-sm text-slate-500 mb-3">
                API アクセスはPro以上のプランで利用可能です
              </p>
              <Link
                href="/tenkai/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                プランを確認
              </Link>
            </div>
          )}
        </motion.div>

        {/* ============ 6. データ管理 ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">storage</span>
            データ管理
          </h2>

          <div className="space-y-4">
            {/* エクスポート */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">データエクスポート</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  すべてのプロジェクトと生成データをJSON形式でダウンロード
                </p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">download</span>
                {exporting ? 'エクスポート中...' : 'エクスポート'}
              </button>
            </div>

            <div className="border-t border-slate-100" />

            {/* アカウント削除 */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-red-600">アカウントを削除</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  アカウントとすべてのデータが完全に削除されます。この操作は取り消せません。
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setDeleteAccountConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete_forever</span>
                  削除
                </button>

                {deleteAccountConfirm && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDeleteAccountConfirm(false)}
                    />
                    <div className="absolute right-0 bottom-12 z-20 w-80 bg-white rounded-xl border border-red-200 shadow-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-xl text-red-500">warning</span>
                        <p className="text-sm font-bold text-slate-900">本当に削除しますか？</p>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        アカウントを削除すると、すべてのプロジェクト、生成済みコンテンツ、設定が
                        完全に削除されます。この操作は取り消すことができません。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteAccountConfirm(false)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleting ? '削除中...' : 'アカウントを削除する'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
