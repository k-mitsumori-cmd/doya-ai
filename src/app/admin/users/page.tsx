'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, Filter, Crown, Mail, Shield, Trash2, Users, 
  ChevronDown, MoreHorizontal, UserPlus, Download, 
  ArrowUpDown, Check, X, Zap, Calendar
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  image: string | null
  plan: 'FREE' | 'STARTER' | 'PRO'
  role: 'USER' | 'ADMIN'
  createdAt: string
  lastActive: string
  totalGenerations: number
  services: string[]
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
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'FREE' | 'STARTER' | 'PRO'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  useEffect(() => {
    setTimeout(() => {
      setUsers([
        {
          id: '1',
          name: '田中太郎',
          email: 'tanaka@example.com',
          image: null,
          plan: 'PRO',
          role: 'ADMIN',
          createdAt: '2024-01-15',
          lastActive: '2時間前',
          totalGenerations: 156,
          services: ['kantan', 'banner'],
        },
        {
          id: '2',
          name: '佐藤花子',
          email: 'sato@example.com',
          image: null,
          plan: 'PRO',
          role: 'USER',
          createdAt: '2024-02-01',
          lastActive: '30分前',
          totalGenerations: 89,
          services: ['banner'],
        },
        {
          id: '3',
          name: '鈴木一郎',
          email: 'suzuki@example.com',
          image: null,
          plan: 'STARTER',
          role: 'USER',
          createdAt: '2024-03-10',
          lastActive: '1日前',
          totalGenerations: 45,
          services: ['kantan'],
        },
        {
          id: '4',
          name: '高橋美咲',
          email: 'takahashi@example.com',
          image: null,
          plan: 'FREE',
          role: 'USER',
          createdAt: '2024-03-15',
          lastActive: '5分前',
          totalGenerations: 8,
          services: ['kantan'],
        },
        {
          id: '5',
          name: '山田健太',
          email: 'yamada@example.com',
          image: null,
          plan: 'FREE',
          role: 'USER',
          createdAt: '2024-03-20',
          lastActive: '3日前',
          totalGenerations: 3,
          services: [],
        },
      ])
      setIsLoading(false)
    }, 500)
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === '' ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlan = planFilter === 'all' || user.plan === planFilter
    return matchesSearch && matchesPlan
  })

  const handleTogglePlan = async (userId: string, currentPlan: string) => {
    const plans: Array<'FREE' | 'STARTER' | 'PRO'> = ['FREE', 'STARTER', 'PRO']
    const currentIndex = plans.indexOf(currentPlan as any)
    const newPlan = plans[(currentIndex + 1) % plans.length]
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan: newPlan } : u))
    toast.success(`プランを${newPlan}に変更しました`)
  }

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER'
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as 'USER' | 'ADMIN' } : u))
    toast.success(`権限を${newRole === 'ADMIN' ? '管理者' : 'ユーザー'}に変更しました`)
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
        return { bg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Crown }
      case 'STARTER':
        return { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: Zap }
      default:
        return { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10', icon: null }
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
            <p className="text-white/40 text-sm">登録ユーザーの管理と権限設定</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <Download className="w-4 h-4" />
              <span className="text-sm">エクスポート</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl hover:opacity-90 transition-all">
              <UserPlus className="w-4 h-4" />
              <span className="text-sm font-bold">ユーザー追加</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '総ユーザー', value: users.length, icon: Users, color: 'from-blue-500 to-cyan-500' },
            { label: 'プロプラン', value: users.filter(u => u.plan === 'PRO').length, icon: Crown, color: 'from-amber-500 to-orange-500' },
            { label: 'スターター', value: users.filter(u => u.plan === 'STARTER').length, icon: Zap, color: 'from-violet-500 to-fuchsia-500' },
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
              onChange={(e) => setPlanFilter(e.target.value as any)}
              className="pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-violet-500/50 outline-none transition-all"
            >
              <option value="all" className="bg-[#0A0A0F]">すべてのプラン</option>
              <option value="FREE" className="bg-[#0A0A0F]">フリー</option>
              <option value="STARTER" className="bg-[#0A0A0F]">スターター</option>
              <option value="PRO" className="bg-[#0A0A0F]">プロ</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl flex items-center justify-between"
          >
            <span className="text-sm text-violet-300">
              {selectedUsers.length}件選択中
            </span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm text-white/70 hover:text-white transition-colors">
                一括メール送信
              </button>
              <button className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors">
                一括削除
              </button>
            </div>
          </motion.div>
        )}

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
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-white transition-colors">
                    ユーザー <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">プラン</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">権限</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">利用サービス</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">生成数</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">最終アクティブ</th>
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-white/40">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleTogglePlan(user.id, user.plan)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${planBadge.bg} ${planBadge.text} ${planBadge.border} text-xs font-medium hover:opacity-80 transition-opacity`}
                      >
                        {planBadge.icon && <planBadge.icon className="w-3 h-3" />}
                        {user.plan}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.role)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:opacity-80 transition-opacity ${
                          user.role === 'ADMIN'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-white/5 text-white/50 border-white/10'
                        }`}
                      >
                        {user.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                        {user.role === 'ADMIN' ? '管理者' : 'ユーザー'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {user.services.includes('kantan') && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] rounded">📝</span>
                        )}
                        {user.services.includes('banner') && (
                          <span className="px-2 py-1 bg-violet-500/20 text-violet-400 text-[10px] rounded">🎨</span>
                        )}
                        {user.services.length === 0 && (
                          <span className="text-white/30 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{user.totalGenerations}</span>
                      <span className="text-white/30 text-xs ml-1">回</span>
                    </td>
                    <td className="px-6 py-4 text-white/40 text-sm">{user.lastActive}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </motion.tbody>
          </table>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-sm text-white/40">
              {filteredUsers.length}件中 1-{filteredUsers.length}件を表示
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50" disabled>
                前へ
              </button>
              <button className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-lg text-sm text-violet-400">
                1
              </button>
              <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50" disabled>
                次へ
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
