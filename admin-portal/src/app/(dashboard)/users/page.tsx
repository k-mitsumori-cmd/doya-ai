'use client'

import { useState, useEffect } from 'react'
import { 
  Users, Search, Filter, Loader2, Crown, Mail, Calendar,
  ChevronLeft, ChevronRight, MoreVertical, ExternalLink, Sparkles
} from 'lucide-react'
import { cn, formatNumber, formatDate, formatRelativeTime } from '@/lib/utils'
import { SERVICES } from '@/lib/services'

interface User {
  id: string
  name: string
  email: string
  service: string
  plan: 'FREE' | 'PREMIUM' | 'PRO'
  generations: number
  createdAt: string
  lastActiveAt: string
}

// モックユーザーデータ
const MOCK_USERS: User[] = [
  { id: '1', name: '田中太郎', email: 'tanaka@example.com', service: 'kantan-doya', plan: 'PREMIUM', generations: 156, createdAt: '2024-01-15', lastActiveAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '2', name: '山田花子', email: 'yamada@example.com', service: 'kantan-doya', plan: 'FREE', generations: 23, createdAt: '2024-02-20', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: '3', name: '佐藤一郎', email: 'sato@example.com', service: 'doya-banner', plan: 'PRO', generations: 89, createdAt: '2024-01-08', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '4', name: '鈴木美咲', email: 'suzuki@example.com', service: 'doya-banner', plan: 'FREE', generations: 12, createdAt: '2024-03-01', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
  { id: '5', name: '高橋健太', email: 'takahashi@example.com', service: 'kantan-doya', plan: 'PREMIUM', generations: 234, createdAt: '2023-12-10', lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: '6', name: '伊藤誠', email: 'ito@example.com', service: 'kantan-doya', plan: 'FREE', generations: 5, createdAt: '2024-03-10', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
  { id: '7', name: '渡辺真理', email: 'watanabe@example.com', service: 'doya-banner', plan: 'PRO', generations: 167, createdAt: '2024-01-20', lastActiveAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: '8', name: '中村愛', email: 'nakamura@example.com', service: 'doya-banner', plan: 'FREE', generations: 8, createdAt: '2024-02-28', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string>('')
  const [planFilter, setPlanFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    // モックデータを読み込み
    setTimeout(() => {
      setUsers(MOCK_USERS)
      setIsLoading(false)
    }, 500)
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      searchQuery === '' ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesService = serviceFilter === '' || user.service === serviceFilter
    const matchesPlan = planFilter === '' || user.plan === planFilter
    
    return matchesSearch && matchesService && matchesPlan
  })

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'PREMIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Crown className="w-3 h-3" />
            プレミアム
          </span>
        )
      case 'PRO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Crown className="w-3 h-3" />
            プロ
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            無料
          </span>
        )
    }
  }

  const getServiceInfo = (serviceId: string) => {
    return SERVICES.find(s => s.id === serviceId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            ユーザー管理
          </h1>
          <p className="text-gray-600">全サービスのユーザーを一元管理</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">総ユーザー数</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(users.length)}</p>
        </div>
      </div>

      {/* フィルター */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="名前またはメールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-12"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">全サービス</option>
              {SERVICES.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.shortName}
                </option>
              ))}
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">全プラン</option>
              <option value="FREE">無料</option>
              <option value="PREMIUM">プレミアム</option>
              <option value="PRO">プロ</option>
            </select>
          </div>
        </div>
      </div>

      {/* ユーザーテーブル */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  サービス
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  プラン
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  生成数
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  最終アクティブ
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedUsers.map((user) => {
                const service = getServiceInfo(user.service)
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{service?.icon}</span>
                        <span className="text-sm text-gray-700">{service?.shortName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getPlanBadge(user.plan)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{formatNumber(user.generations)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{formatRelativeTime(user.lastActiveAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{formatDate(user.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {formatNumber(filteredUsers.length)}件中 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)}件を表示
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

