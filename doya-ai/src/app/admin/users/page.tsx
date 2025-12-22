'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Crown, Mail, Shield, Trash2, Users, 
  ChevronDown, MoreHorizontal, Download, 
  ArrowUpDown, Check, Zap, X, Edit3, RotateCcw,
  Save, AlertCircle
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
  totalGenerations: number
  serviceSubscriptions: ServiceSubscription[]
  services: string[]
}

const SERVICE_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  banner: { name: 'ドヤバナー', icon: '🎨', color: 'violet' },
  kantan: { name: 'カンタンドヤ', icon: '📝', color: 'blue' },
  seo: { name: 'ドヤSEO', icon: '🧠', color: 'emerald' },
}

const PLAN_OPTIONS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

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

  const handleUpdateServicePlan = async (userId: string, serviceId: string, newPlan: string) => {
    await handleUpdateUser(userId, { serviceId, servicePlan: newPlan })
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

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'PRO':
      case 'BUSINESS':
      case 'ENTERPRISE':
        return { bg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Crown }
      case 'STARTER':
        return { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: Zap }
      default:
        return { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10', icon: null }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
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
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <Download className="w-4 h-4" />
              <span className="text-sm">エクスポート</span>
            </button>
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
              <option value="FREE" className="bg-[#0A0A0F]">FREE</option>
              <option value="PRO" className="bg-[#0A0A0F]">PRO</option>
              <option value="BUSINESS" className="bg-[#0A0A0F]">BUSINESS</option>
              <option value="ENTERPRISE" className="bg-[#0A0A0F]">ENTERPRISE</option>
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
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">権限</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">サービス別</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">生成数</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">登録日</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
              {filteredUsers.map((user) => {
                const planBadge = getPlanBadge(user.plan)
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
                    <td className="px-6 py-4">
                      <select
                        value={user.plan}
                        onChange={async (e) => {
                          await handleUpdateUser(user.id, { plan: e.target.value })
                        }}
                        disabled={isSaving}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium appearance-none cursor-pointer outline-none transition-all disabled:opacity-50 ${planBadge.bg} ${planBadge.text} ${planBadge.border}`}
                      >
                        {PLAN_OPTIONS.map((p) => (
                          <option key={p} value={p} className="bg-[#0A0A0F]">{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={async (e) => {
                          await handleUpdateUser(user.id, { role: e.target.value })
                        }}
                        disabled={isSaving}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium appearance-none cursor-pointer outline-none transition-all disabled:opacity-50 ${
                          user.role === 'ADMIN'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-white/5 text-white/50 border-white/10'
                        }`}
                      >
                        <option value="USER" className="bg-[#0A0A0F]">ユーザー</option>
                        <option value="ADMIN" className="bg-[#0A0A0F]">管理者</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {['banner', 'kantan', 'seo'].map((serviceId) => {
                          const svc = SERVICE_LABELS[serviceId]
                          const sub = user.serviceSubscriptions.find((s) => s.serviceId === serviceId)
                          const currentPlan = sub?.plan || 'FREE'
                          return (
                            <div key={serviceId} className="flex items-center gap-2 text-xs">
                              <span title={svc.name}>{svc.icon}</span>
                              <select
                                value={currentPlan}
                                onChange={async (e) => {
                                  await handleUpdateServicePlan(user.id, serviceId, e.target.value)
                                }}
                                disabled={isSaving}
                                className={`px-2 py-1 rounded text-xs font-medium appearance-none cursor-pointer outline-none transition-all disabled:opacity-50 ${
                                  currentPlan === 'FREE' 
                                    ? 'bg-white/5 text-white/50 border border-white/10' 
                                    : currentPlan === 'STARTER'
                                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {PLAN_OPTIONS.map((p) => (
                                  <option key={p} value={p} className="bg-[#0A0A0F]">{p}</option>
                                ))}
                              </select>
                              {sub && (
                                <>
                                  <span className="text-white/40">{sub.dailyUsage}回</span>
                                  <button
                                    onClick={() => handleResetUsage(user.id, serviceId, 'daily')}
                                    disabled={isSaving}
                                    className="p-0.5 hover:bg-white/10 rounded text-white/30 hover:text-white transition-colors disabled:opacity-50"
                                    title="リセット"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
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
                        <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                          <Mail className="w-4 h-4" />
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

                {/* Global Plan & Role */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">グローバルプラン</label>
                    <select
                      value={editingUser.plan}
                      onChange={async (e) => {
                        await handleUpdateUser(editingUser.id, { plan: e.target.value })
                        setEditingUser({ ...editingUser, plan: e.target.value })
                      }}
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-violet-500/50 outline-none transition-all disabled:opacity-50"
                    >
                      {PLAN_OPTIONS.map((p) => (
                        <option key={p} value={p} className="bg-[#1a1a24]">{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">権限</label>
                    <select
                      value={editingUser.role}
                      onChange={async (e) => {
                        await handleUpdateUser(editingUser.id, { role: e.target.value })
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }}
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-violet-500/50 outline-none transition-all disabled:opacity-50"
                    >
                      <option value="USER" className="bg-[#1a1a24]">ユーザー</option>
                      <option value="ADMIN" className="bg-[#1a1a24]">管理者</option>
                    </select>
                  </div>
                </div>

                {/* Service Subscriptions */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">サービス別設定</h3>
                  <div className="space-y-3">
                    {['banner', 'kantan', 'seo'].map((serviceId) => {
                      const svc = SERVICE_LABELS[serviceId]
                      const sub = editingUser.serviceSubscriptions.find((s) => s.serviceId === serviceId)
                      return (
                        <div key={serviceId} className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{svc.icon}</span>
                              <span className="font-medium text-white">{svc.name}</span>
                            </div>
                            <select
                              value={sub?.plan || 'FREE'}
                              onChange={async (e) => {
                                await handleUpdateServicePlan(editingUser.id, serviceId, e.target.value)
                                await fetchUsers()
                                const updated = users.find((u) => u.id === editingUser.id)
                                if (updated) setEditingUser(updated)
                              }}
                              disabled={isSaving}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white appearance-none cursor-pointer focus:border-violet-500/50 outline-none transition-all disabled:opacity-50"
                            >
                              {PLAN_OPTIONS.map((p) => (
                                <option key={p} value={p} className="bg-[#1a1a24]">{p}</option>
                              ))}
                            </select>
                          </div>
                          {sub && (
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-white/40">日次使用:</span>
                                <span className="text-white font-medium">{sub.dailyUsage}回</span>
                                <button
                                  onClick={async () => {
                                    await handleResetUsage(editingUser.id, serviceId, 'daily')
                                    await fetchUsers()
                                    const updated = users.find((u) => u.id === editingUser.id)
                                    if (updated) setEditingUser(updated)
                                  }}
                                  disabled={isSaving}
                                  className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                                >
                                  リセット
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white/40">月次使用:</span>
                                <span className="text-white font-medium">{sub.monthlyUsage}回</span>
                                <button
                                  onClick={async () => {
                                    await handleResetUsage(editingUser.id, serviceId, 'monthly')
                                    await fetchUsers()
                                    const updated = users.find((u) => u.id === editingUser.id)
                                    if (updated) setEditingUser(updated)
                                  }}
                                  disabled={isSaving}
                                  className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                                >
                                  リセット
                                </button>
                              </div>
                            </div>
                          )}
                          {!sub && (
                            <p className="text-xs text-white/40">このサービスの利用履歴はありません</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Stripe Info */}
                {(editingUser.stripeCustomerId || editingUser.stripeSubscriptionId) && (
                  <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                    <h3 className="text-sm font-medium text-violet-400 mb-2">Stripe連携情報</h3>
                    <div className="text-xs text-white/60 space-y-1">
                      {editingUser.stripeCustomerId && (
                        <p>Customer ID: {editingUser.stripeCustomerId}</p>
                      )}
                      {editingUser.stripeSubscriptionId && (
                        <p>Subscription ID: {editingUser.stripeSubscriptionId}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/10">
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
