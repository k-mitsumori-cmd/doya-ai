'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Crown, Mail, Shield, Users, 
  ChevronDown, Download, Check, X, Edit3, RotateCcw, Zap, Calendar, AlertTriangle, Trash2
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface ServiceSubscription {
  id: string
  serviceId: string
  plan: string
  dailyUsage: number
  monthlyUsage: number
  lastUsageReset: string
  hasStripe: boolean
}

interface StripeInfo {
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  created: string
  amount: number
  interval: string
}

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  plan: string
  role: string
  createdAt: string
  updatedAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripeInfo: StripeInfo | null
  totalGenerations: number
  serviceSubscriptions: ServiceSubscription[]
  services: string[]
}

// コンプリートパック（共通プラン）設定
// バナーAIとライティングAIは同じプランで連動
const COMPLETE_PACK_PLANS: Record<string, { 
  label: string
  bannerLimit: number
  writingLimit: number
  color: string
}> = {
  FREE: { label: 'おためし', bannerLimit: 9, writingLimit: 1, color: 'gray' },
  PRO: { label: 'プロ', bannerLimit: 50, writingLimit: 5, color: 'amber' },
  ENTERPRISE: { label: 'エンタープライズ', bannerLimit: 500, writingLimit: 50, color: 'rose' },
}

// サービス別の表示設定（プランは共通）
const SERVICE_DISPLAY = {
  banner: { name: 'ドヤバナーAI', emoji: '🎨', unit: '枚' },
  writing: { name: 'ドヤライティングAI', emoji: '✍️', unit: '件' },
}

const PLAN_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  FREE: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'おためし' },
  PRO: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'プロ' },
  ENTERPRISE: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', label: 'エンタープライズ' },
}

const PLAN_OPTIONS = ['FREE', 'PRO', 'ENTERPRISE']

// 残り生成可能数を計算（共通プラン）
function getRemainingGenerations(serviceId: string, plan: string, dailyUsage: number): number {
  const planConfig = COMPLETE_PACK_PLANS[plan] || COMPLETE_PACK_PLANS.FREE
  const limit = serviceId === 'banner' ? planConfig.bannerLimit : planConfig.writingLimit
  return Math.max(0, limit - dailyUsage)
}

function getDailyLimit(serviceId: string, plan: string): number {
  const planConfig = COMPLETE_PACK_PLANS[plan] || COMPLETE_PACK_PLANS.FREE
  return serviceId === 'banner' ? planConfig.bannerLimit : planConfig.writingLimit
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('ユーザー一覧の取得に失敗しました')
      }
      
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Users fetch error:', error)
      toast.error('ユーザー一覧の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // エクスポートメニューを閉じる（外部クリック）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportMenu) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-export-menu]')) {
          setShowExportMenu(false)
        }
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showExportMenu])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === '' ||
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesPlan = planFilter === 'all' || user.plan === planFilter
    return matchesSearch && matchesPlan
  })

  const handleUpdateUser = async (userId: string, updates: any) => {
    try {
      setIsSaving(true)
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, ...updates }),
      })

      if (!response.ok) {
        throw new Error('更新に失敗しました')
      }

      await fetchUsers()
      toast.success('ユーザー情報を更新しました')
      return true
    } catch (error) {
      console.error('Update error:', error)
      toast.error('更新に失敗しました')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetUsage = async (userId: string, serviceId: string, type: 'daily' | 'monthly') => {
    const updates = type === 'daily' 
      ? { serviceId, resetDailyUsage: true }
      : { serviceId, resetMonthlyUsage: true }
    await handleUpdateUser(userId, updates)
  }

  // コンプリートパック: 両サービスのプランを同時に更新
  const handleUpdateCompletePlan = async (userId: string, newPlan: string) => {
    try {
      setIsSaving(true)
      // bannerとwriting両方を更新
      const response1 = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, serviceId: 'banner', servicePlan: newPlan }),
      })
      const response2 = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, serviceId: 'writing', servicePlan: newPlan }),
      })
      // ユーザー本体のplanも更新
      const response3 = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, plan: newPlan }),
      })

      if (!response1.ok || !response2.ok || !response3.ok) {
        throw new Error('更新に失敗しました')
      }

      await fetchUsers()
      toast.success('プランを更新しました（コンプリートパック）')
      return true
    } catch (error) {
      console.error('Update error:', error)
      toast.error('更新に失敗しました')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateServicePlan = async (userId: string, serviceId: string, newPlan: string) => {
    // コンプリートパックなので両方同時に更新
    await handleUpdateCompletePlan(userId, newPlan)
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // エクスポート処理
  const handleExport = async (format: 'csv' | 'json', includeStripe: boolean = false) => {
    setIsExporting(true)
    setShowExportMenu(false)
    
    try {
      const params = new URLSearchParams({
        format,
        includeStripe: includeStripe.toString(),
      })
      
      const response = await fetch(`/api/admin/users/export?${params}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('エクスポートに失敗しました')
      }
      
      // ファイルをダウンロード
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success(`${format.toUpperCase()}形式でエクスポートしました`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  // 削除処理
  const handleDeleteUser = async (user: User) => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('確認テキストを正しく入力してください')
      return
    }

    setDeletingUserId(user.id)
    
    try {
      const response = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '削除に失敗しました')
      }
      
      toast.success(`${user.email || user.name || 'ユーザー'} を削除しました`)
      setShowDeleteConfirm(null)
      setDeleteConfirmText('')
      
      // ユーザー一覧を更新
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    } finally {
      setDeletingUserId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">ユーザー管理</h1>
            <p className="text-white/40 text-sm">登録ユーザーの管理と権限設定（実データ）</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">更新</span>
            </button>
            <div className="relative" data-export-menu>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-sm">エクスポート</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {/* Export Dropdown Menu */}
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2">
                      <p className="px-3 py-2 text-xs font-medium text-white/40 uppercase">CSV形式</p>
                      <button
                        onClick={() => handleExport('csv', false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <div className="text-left">
                          <p className="font-medium">基本情報のみ</p>
                          <p className="text-xs text-white/40">ユーザー名、メール、プラン等</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleExport('csv', true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-amber-400" />
                        <div className="text-left">
                          <p className="font-medium">Stripe情報を含む</p>
                          <p className="text-xs text-white/40">顧客ID、契約期間等</p>
                        </div>
                      </button>
                    </div>
                    <div className="border-t border-white/10 p-2">
                      <p className="px-3 py-2 text-xs font-medium text-white/40 uppercase">JSON形式</p>
                      <button
                        onClick={() => handleExport('json', false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-blue-400" />
                        <div className="text-left">
                          <p className="font-medium">JSON（基本情報）</p>
                          <p className="text-xs text-white/40">開発者向けフォーマット</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleExport('json', true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-violet-400" />
                        <div className="text-left">
                          <p className="font-medium">JSON（全情報）</p>
                          <p className="text-xs text-white/40">Stripe情報を含む</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '総ユーザー', value: users.length, icon: Users, color: 'from-blue-500 to-cyan-500' },
            { label: '有料会員', value: users.filter(u => ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(u.plan)).length, icon: Crown, color: 'from-amber-500 to-orange-500' },
            { label: 'Stripe連携', value: users.filter(u => u.stripeSubscriptionId).length, icon: Zap, color: 'from-violet-500 to-fuchsia-500' },
            { label: '管理者', value: users.filter(u => u.role === 'ADMIN').length, icon: Shield, color: 'from-emerald-500 to-green-500' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/[0.02] backdrop-blur rounded-xl border border-white/5 p-4"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/40">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              placeholder="名前またはメールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-violet-500/50 outline-none transition-all"
            >
              <option value="all" className="bg-[#0A0A0F]">すべてのプラン</option>
              <option value="FREE" className="bg-[#0A0A0F]">おためし</option>
              <option value="PRO" className="bg-[#0A0A0F]">プロ</option>
              <option value="ENTERPRISE" className="bg-[#0A0A0F]">エンタープライズ</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-4">
                  <button
                    onClick={handleSelectAll}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedUsers.length === filteredUsers.length && filteredUsers.length > 0
                        ? 'bg-violet-500 border-violet-500'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selectedUsers.length === filteredUsers.length && filteredUsers.length > 0 && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">ユーザー</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">プラン</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">🎨 バナー残り</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">✍️ ライティング残り</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">課金状態</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">合計生成</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">登録日</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id)
                return (
                  <motion.tr
                    key={user.id}
                    variants={rowVariants}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                      isSelected ? 'bg-violet-500/5' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleSelectUser(user.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-violet-500 border-violet-500'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img src={user.image} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{user.name || '(未設定)'}</p>
                          <p className="text-xs text-white/40">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* コンプリートパック プラン列 */}
                    <td className="px-6 py-4">
                      {(() => {
                        // 共通プランを取得（bannerとwritingは連動）
                        const bannerSub = user.serviceSubscriptions.find((s) => s.serviceId === 'banner')
                        const currentPlan = bannerSub?.plan || user.plan || 'FREE'
                        const planStyle = PLAN_STYLES[currentPlan] || PLAN_STYLES.FREE
                        return (
                          <select
                            value={currentPlan}
                            onChange={async (e) => {
                              await handleUpdateCompletePlan(user.id, e.target.value)
                            }}
                            disabled={isSaving}
                            className={`px-3 py-2 rounded-lg border text-xs font-bold appearance-none cursor-pointer outline-none transition-all disabled:opacity-50 min-w-[120px] ${planStyle.bg} ${planStyle.text} ${planStyle.border}`}
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p} value={p} className="bg-[#0A0A0F]">
                                {PLAN_STYLES[p]?.label || p}
                              </option>
                            ))}
                          </select>
                        )
                      })()}
                    </td>
                    {/* バナー残り生成数 列 */}
                    <td className="px-6 py-4">
                      {(() => {
                        const bannerSub = user.serviceSubscriptions.find((s) => s.serviceId === 'banner')
                        const currentPlan = bannerSub?.plan || user.plan || 'FREE'
                        const dailyUsage = bannerSub?.dailyUsage || 0
                        const remaining = getRemainingGenerations('banner', currentPlan, dailyUsage)
                        const limit = getDailyLimit('banner', currentPlan)
                        return (
                          <div className="flex items-center gap-1">
                            <span className={`text-lg font-bold ${remaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {remaining}
                            </span>
                            <span className="text-white/30 text-xs">/ {limit}枚</span>
                          </div>
                        )
                      })()}
                    </td>
                    {/* ライティング残り生成数 列 */}
                    <td className="px-6 py-4">
                      {(() => {
                        // コンプリートパックなのでbannerのプランを参照（共通プラン）
                        const bannerSub = user.serviceSubscriptions.find((s) => s.serviceId === 'banner')
                        const writingSub = user.serviceSubscriptions.find((s) => s.serviceId === 'writing')
                        const currentPlan = bannerSub?.plan || user.plan || 'FREE'
                        const dailyUsage = writingSub?.dailyUsage || 0
                        const remaining = getRemainingGenerations('writing', currentPlan, dailyUsage)
                        const limit = getDailyLimit('writing', currentPlan)
                        return (
                          <div className="flex items-center gap-1">
                            <span className={`text-lg font-bold ${remaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {remaining}
                            </span>
                            <span className="text-white/30 text-xs">/ {limit}件</span>
                          </div>
                        )
                      })()}
                    </td>
                    {/* 課金状態 列 */}
                    <td className="px-6 py-4">
                      {user.stripeInfo ? (
                        <div className="flex flex-col gap-1">
                          {user.stripeInfo.cancelAtPeriodEnd ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              解約予定
                            </span>
                          ) : user.stripeInfo.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full w-fit">
                              <Zap className="w-3 h-3" />
                              課金中
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full w-fit">
                              {user.stripeInfo.status}
                            </span>
                          )}
                          <span className="text-[10px] text-white/40">
                            {user.stripeInfo.cancelAtPeriodEnd 
                              ? `${new Date(user.stripeInfo.currentPeriodEnd).toLocaleDateString('ja-JP')}まで`
                              : `契約: ${new Date(user.stripeInfo.created).toLocaleDateString('ja-JP')}`
                            }
                          </span>
                        </div>
                      ) : (
                        <span className="text-white/30 text-xs">-</span>
                      )}
                    </td>
                    {/* 合計生成数 列 */}
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{user.totalGenerations}</span>
                      <span className="text-white/30 text-xs ml-1">回</span>
                    </td>
                    <td className="px-6 py-4 text-white/40 text-sm">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                          title="詳細編集"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors" title="メール送信">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setShowDeleteConfirm(user)
                            setDeleteConfirmText('')
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </motion.tbody>
          </table>

          {/* Empty State */}
          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ユーザーが見つかりません</p>
              <p className="text-sm mt-1">検索条件を変更してください</p>
            </div>
          )}

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-sm text-white/40">
              {filteredUsers.length}件を表示
            </p>
          </div>
        </div>
      </motion.div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a24] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">ユーザー詳細編集</h2>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  {editingUser.image ? (
                    <img src={editingUser.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-2xl">
                      {(editingUser.name || editingUser.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold text-white">{editingUser.name || '(未設定)'}</p>
                    <p className="text-white/60">{editingUser.email}</p>
                    <p className="text-xs text-white/40 mt-1">ID: {editingUser.id}</p>
                  </div>
                </div>

                {/* コンプリートパック プラン設定 */}
                <div className="p-4 bg-gradient-to-br from-violet-500/10 to-emerald-500/10 rounded-xl border border-violet-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex -space-x-2">
                      <span className="text-2xl">🎨</span>
                      <span className="text-2xl">✍️</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">コンプリートパック</h3>
                      <p className="text-xs text-white/40">ドヤバナーAI ＋ ドヤライティングAI</p>
                    </div>
                  </div>
                  
                  {(() => {
                    const bannerSub = editingUser.serviceSubscriptions.find((s) => s.serviceId === 'banner')
                    const writingSub = editingUser.serviceSubscriptions.find((s) => s.serviceId === 'writing')
                    const currentPlan = bannerSub?.plan || editingUser.plan || 'FREE'
                    const planStyle = PLAN_STYLES[currentPlan] || PLAN_STYLES.FREE
                    
                    const bannerUsage = bannerSub?.dailyUsage || 0
                    const bannerRemaining = getRemainingGenerations('banner', currentPlan, bannerUsage)
                    const bannerLimit = getDailyLimit('banner', currentPlan)
                    
                    const writingUsage = writingSub?.dailyUsage || 0
                    const writingRemaining = getRemainingGenerations('writing', currentPlan, writingUsage)
                    const writingLimit = getDailyLimit('writing', currentPlan)
                    
                    return (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm text-white/60 mb-2">プラン（両サービス共通）</label>
                          <select
                            value={currentPlan}
                            onChange={async (e) => {
                              await handleUpdateCompletePlan(editingUser.id, e.target.value)
                              await fetchUsers()
                              const updated = users.find((u) => u.id === editingUser.id)
                              if (updated) setEditingUser(updated)
                            }}
                            disabled={isSaving}
                            className={`w-full px-4 py-3 rounded-xl appearance-none cursor-pointer outline-none transition-all disabled:opacity-50 border ${planStyle.bg} ${planStyle.text} ${planStyle.border}`}
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p} value={p} className="bg-[#1a1a24]">
                                {PLAN_STYLES[p]?.label || p}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* バナーAI 使用状況 */}
                        <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span>🎨</span>
                            <span className="text-sm font-medium text-white">ドヤバナーAI</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-white/40 mb-1">本日の残り</p>
                              <p className={`text-xl font-bold ${bannerRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {bannerRemaining}<span className="text-xs text-white/40 ml-1">/ {bannerLimit}枚</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">本日の使用</p>
                              <p className="text-xl font-bold text-white">
                                {bannerUsage}<span className="text-xs text-white/40 ml-1">枚</span>
                              </p>
                            </div>
                          </div>
                          {bannerSub && (
                            <button
                              onClick={async () => {
                                await handleResetUsage(editingUser.id, 'banner', 'daily')
                                await fetchUsers()
                                const updated = users.find((u) => u.id === editingUser.id)
                                if (updated) setEditingUser(updated)
                              }}
                              disabled={isSaving}
                              className="w-full mt-2 px-3 py-1.5 text-xs bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                            >
                              使用回数をリセット
                            </button>
                          )}
                        </div>
                        
                        {/* ライティングAI 使用状況 */}
                        <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span>✍️</span>
                            <span className="text-sm font-medium text-white">ドヤライティングAI</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-white/40 mb-1">本日の残り</p>
                              <p className={`text-xl font-bold ${writingRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {writingRemaining}<span className="text-xs text-white/40 ml-1">/ {writingLimit}件</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">本日の使用</p>
                              <p className="text-xl font-bold text-white">
                                {writingUsage}<span className="text-xs text-white/40 ml-1">件</span>
                              </p>
                            </div>
                          </div>
                          {writingSub && (
                            <button
                              onClick={async () => {
                                await handleResetUsage(editingUser.id, 'writing', 'daily')
                                await fetchUsers()
                                const updated = users.find((u) => u.id === editingUser.id)
                                if (updated) setEditingUser(updated)
                              }}
                              disabled={isSaving}
                              className="w-full mt-2 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                            >
                              使用回数をリセット
                            </button>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Stripe課金管理 */}
                {editingUser.stripeSubscriptionId && (
                  <div className={`p-4 rounded-xl border ${
                    editingUser.stripeInfo?.cancelAtPeriodEnd 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${editingUser.stripeInfo?.cancelAtPeriodEnd ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <h3 className={`text-sm font-medium ${editingUser.stripeInfo?.cancelAtPeriodEnd ? 'text-amber-400' : 'text-emerald-400'}`}>
                          Stripe課金管理
                        </h3>
                      </div>
                      {editingUser.stripeInfo?.cancelAtPeriodEnd && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          解約予定
                        </span>
                      )}
                    </div>

                    {/* 契約情報 */}
                    {editingUser.stripeInfo && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-1 text-white/40 text-xs mb-1">
                            <Calendar className="w-3 h-3" />
                            契約開始日
                          </div>
                          <p className="text-sm font-medium text-white">
                            {new Date(editingUser.stripeInfo.created).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-1 text-white/40 text-xs mb-1">
                            <Calendar className="w-3 h-3" />
                            次回請求日
                          </div>
                          <p className="text-sm font-medium text-white">
                            {new Date(editingUser.stripeInfo.currentPeriodEnd).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="text-white/40 text-xs mb-1">月額料金</div>
                          <p className="text-sm font-medium text-white">
                            ¥{(editingUser.stripeInfo.amount / 100).toLocaleString()}/{editingUser.stripeInfo.interval === 'month' ? '月' : '年'}
                          </p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="text-white/40 text-xs mb-1">ステータス</div>
                          <p className={`text-sm font-medium ${
                            editingUser.stripeInfo.status === 'active' ? 'text-emerald-400' :
                            editingUser.stripeInfo.status === 'canceled' ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                            {editingUser.stripeInfo.status === 'active' ? 'アクティブ' :
                             editingUser.stripeInfo.status === 'canceled' ? 'キャンセル済み' :
                             editingUser.stripeInfo.status === 'past_due' ? '支払い遅延' :
                             editingUser.stripeInfo.status}
                          </p>
                        </div>
                      </div>
                    )}

                    {editingUser.stripeInfo?.cancelAtPeriodEnd && (
                      <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-400">
                          ⚠️ このユーザーは<strong>{new Date(editingUser.stripeInfo.currentPeriodEnd).toLocaleDateString('ja-JP')}</strong>に解約予定です
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-white/40 space-y-1 mb-4">
                      <p>Customer: <span className="text-white/60 font-mono">{editingUser.stripeCustomerId?.slice(0, 25)}...</span></p>
                      <p>Subscription: <span className="text-white/60 font-mono">{editingUser.stripeSubscriptionId?.slice(0, 25)}...</span></p>
                    </div>

                    <div className="flex gap-2">
                      {editingUser.stripeInfo?.cancelAtPeriodEnd ? (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/admin/stripe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ userId: editingUser.id, action: 'resume' }),
                              })
                              if (res.ok) {
                                toast.success('解約予約を取り消しました')
                                await fetchUsers()
                                const updated = users.find((u) => u.id === editingUser.id)
                                if (updated) setEditingUser(updated)
                              } else {
                                toast.error('操作に失敗しました')
                              }
                            } catch (e) {
                              toast.error('エラーが発生しました')
                            }
                          }}
                          disabled={isSaving}
                          className="flex-1 px-3 py-2 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          解約予約を取り消す
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!confirm('この期間の終了時にサブスクリプションをキャンセルしますか？')) return
                            try {
                              const res = await fetch('/api/admin/stripe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ userId: editingUser.id, action: 'cancel' }),
                              })
                              if (res.ok) {
                                toast.success('キャンセル予約しました')
                                await fetchUsers()
                                const updated = users.find((u) => u.id === editingUser.id)
                                if (updated) setEditingUser(updated)
                              } else {
                                toast.error('キャンセルに失敗しました')
                              }
                            } catch (e) {
                              toast.error('エラーが発生しました')
                            }
                          }}
                          disabled={isSaving}
                          className="flex-1 px-3 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                        >
                          期間終了時にキャンセル
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('即座にサブスクリプションをキャンセルしますか？この操作は取り消せません。')) return
                          try {
                            const res = await fetch('/api/admin/stripe', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ userId: editingUser.id, action: 'cancel_immediately' }),
                            })
                            if (res.ok) {
                              toast.success('サブスクリプションをキャンセルしました')
                              await fetchUsers()
                              const updated = users.find((u) => u.id === editingUser.id)
                              if (updated) setEditingUser(updated)
                            } else {
                              toast.error('キャンセルに失敗しました')
                            }
                          } catch (e) {
                            toast.error('エラーが発生しました')
                          }
                        }}
                        disabled={isSaving}
                        className="flex-1 px-3 py-2 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        即時キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/10 space-y-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(editingUser)
                    setDeleteConfirmText('')
                    setEditingUser(null)
                  }}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl font-medium text-red-400 border border-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  このユーザーを削除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12121a] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">ユーザーを削除</h3>
                    <p className="text-sm text-white/40">この操作は取り消せません</p>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    {showDeleteConfirm.image ? (
                      <img src={showDeleteConfirm.image} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                        {(showDeleteConfirm.name || showDeleteConfirm.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{showDeleteConfirm.name || '名前なし'}</p>
                      <p className="text-sm text-white/50">{showDeleteConfirm.email}</p>
                    </div>
                  </div>
                  <div className="text-xs text-red-300 space-y-1 mt-3">
                    <p>• すべての生成履歴が削除されます</p>
                    <p>• Stripeサブスクリプションがキャンセルされます</p>
                    <p>• ログイン情報が削除されます</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    確認のため <span className="text-red-400 font-bold">DELETE</span> と入力してください
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(null)
                      setDeleteConfirmText('')
                    }}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => handleDeleteUser(showDeleteConfirm)}
                    disabled={deleteConfirmText !== 'DELETE' || deletingUserId === showDeleteConfirm.id}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingUserId === showDeleteConfirm.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        削除中...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        削除する
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
