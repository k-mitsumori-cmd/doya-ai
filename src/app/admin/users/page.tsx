'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Crown, MoreVertical, Mail, Shield, Trash2 } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  image: string | null
  plan: 'FREE' | 'PREMIUM'
  role: 'USER' | 'ADMIN'
  createdAt: string
  totalGenerations: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'FREE' | 'PREMIUM'>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 実際にはAPIから取得
    setTimeout(() => {
      setUsers([
        {
          id: '1',
          name: '田中太郎',
          email: 'tanaka@example.com',
          image: null,
          plan: 'PREMIUM',
          role: 'ADMIN',
          createdAt: '2024-01-15',
          totalGenerations: 156,
        },
        {
          id: '2',
          name: '佐藤花子',
          email: 'sato@example.com',
          image: null,
          plan: 'PREMIUM',
          role: 'USER',
          createdAt: '2024-02-01',
          totalGenerations: 89,
        },
        {
          id: '3',
          name: '鈴木一郎',
          email: 'suzuki@example.com',
          image: null,
          plan: 'FREE',
          role: 'USER',
          createdAt: '2024-03-10',
          totalGenerations: 15,
        },
        {
          id: '4',
          name: '高橋美咲',
          email: 'takahashi@example.com',
          image: null,
          plan: 'FREE',
          role: 'USER',
          createdAt: '2024-03-15',
          totalGenerations: 8,
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
    const newPlan = currentPlan === 'FREE' ? 'PREMIUM' : 'FREE'
    // 実際にはAPIを呼び出してプランを変更
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, plan: newPlan as 'FREE' | 'PREMIUM' } : u
      )
    )
  }

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER'
    // 実際にはAPIを呼び出してロールを変更
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, role: newRole as 'USER' | 'ADMIN' } : u
      )
    )
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">
          ユーザー管理
        </h1>
        <p className="text-gray-600">登録ユーザーの管理と権限設定を行います</p>
      </div>

      {/* 検索とフィルター */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="名前またはメールアドレスで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as 'all' | 'FREE' | 'PREMIUM')}
            className="pl-12 pr-8 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="all">すべてのプラン</option>
            <option value="FREE">フリー</option>
            <option value="PREMIUM">プレミアム</option>
          </select>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">総ユーザー数</p>
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">プレミアム</p>
          <p className="text-2xl font-bold text-amber-500">
            {users.filter((u) => u.plan === 'PREMIUM').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">管理者</p>
          <p className="text-2xl font-bold text-primary-500">
            {users.filter((u) => u.role === 'ADMIN').length}
          </p>
        </div>
      </div>

      {/* ユーザーテーブル */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ユーザー</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">プラン</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">権限</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">生成回数</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">登録日</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">{user.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleTogglePlan(user.id, user.plan)}
                    className={`badge ${
                      user.plan === 'PREMIUM' ? 'badge-premium' : 'bg-gray-100 text-gray-600'
                    } cursor-pointer hover:opacity-80`}
                  >
                    {user.plan === 'PREMIUM' && <Crown className="w-3 h-3 mr-1" />}
                    {user.plan === 'PREMIUM' ? 'プレミアム' : 'フリー'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleAdmin(user.id, user.role)}
                    className={`badge ${
                      user.role === 'ADMIN' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                    } cursor-pointer hover:opacity-80`}
                  >
                    {user.role === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                    {user.role === 'ADMIN' ? '管理者' : 'ユーザー'}
                  </button>
                </td>
                <td className="px-6 py-4 text-gray-900">{user.totalGenerations}回</td>
                <td className="px-6 py-4 text-gray-500">{user.createdAt}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


