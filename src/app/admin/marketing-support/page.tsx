'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Target, 
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Mail,
  Phone,
  ExternalLink,
  Plus,
  Filter,
  Search
} from 'lucide-react'
import Link from 'next/link'

const supportRequests = [
  {
    id: 1,
    company: '株式会社テックイノベーション',
    contact: '田中 太郎',
    email: 'tanaka@tech-innovation.co.jp',
    type: 'LP制作',
    plan: 'Enterprise',
    status: '対応中',
    priority: '高',
    requestDate: '2024/12/10',
    details: '新サービスのLP制作をお願いしたい。ターゲットはIT企業のマーケティング担当者。',
    assignee: '三森',
  },
  {
    id: 2,
    company: 'ABCマーケティング株式会社',
    contact: '佐藤 花子',
    email: 'sato@abc-marketing.jp',
    type: '広告運用',
    plan: 'Enterprise',
    status: '見積中',
    priority: '中',
    requestDate: '2024/12/12',
    details: 'Google広告とFacebook広告の運用代行を検討中。月予算50万円程度。',
    assignee: '土山',
  },
  {
    id: 3,
    company: 'スタートアップX',
    contact: '鈴木 一郎',
    email: 'suzuki@startup-x.com',
    type: '事例作成',
    plan: 'Business',
    status: '完了',
    priority: '低',
    requestDate: '2024/12/05',
    details: '導入事例のインタビューと記事化。既存顧客3社分をお願いしたい。',
    assignee: '三森',
  },
  {
    id: 4,
    company: 'グローバルEC株式会社',
    contact: '高橋 美咲',
    email: 'takahashi@global-ec.co.jp',
    type: '営業資料',
    plan: 'Enterprise',
    status: '新規',
    priority: '高',
    requestDate: '2024/12/14',
    details: '展示会用の営業資料とカタログのデザインを希望。来月の展示会に間に合わせたい。',
    assignee: null,
  },
]

const supportTypes = [
  { id: 'lp', name: 'LP制作', icon: FileText, color: 'bg-blue-500' },
  { id: 'ad', name: '広告運用', icon: TrendingUp, color: 'bg-green-500' },
  { id: 'case', name: '事例作成', icon: MessageSquare, color: 'bg-purple-500' },
  { id: 'sales', name: '営業資料', icon: Users, color: 'bg-amber-500' },
]

export default function MarketingSupportPage() {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<typeof supportRequests[0] | null>(null)

  const filteredRequests = supportRequests.filter(req => {
    if (filter !== 'all' && req.status !== filter) return false
    if (searchQuery && !req.company.includes(searchQuery) && !req.contact.includes(searchQuery)) return false
    return true
  })

  const statusColors: Record<string, string> = {
    '新規': 'bg-blue-500/20 text-blue-400',
    '対応中': 'bg-amber-500/20 text-amber-400',
    '見積中': 'bg-purple-500/20 text-purple-400',
    '完了': 'bg-green-500/20 text-green-400',
  }

  const priorityColors: Record<string, string> = {
    '高': 'text-red-400',
    '中': 'text-amber-400',
    '低': 'text-gray-400',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                マーケティング支援申請
              </h1>
              <p className="text-xs text-gray-400">三森・土山チームへの支援依頼を管理</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" />
            新規依頼を作成
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '新規', count: 1, color: 'from-blue-500 to-cyan-500' },
            { label: '対応中', count: 1, color: 'from-amber-500 to-orange-500' },
            { label: '見積中', count: 1, color: 'from-purple-500 to-pink-500' },
            { label: '完了', count: 1, color: 'from-green-500 to-emerald-500' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <span className="font-bold">{stat.count}</span>
              </div>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* リスト */}
          <div className="lg:col-span-2">
            {/* フィルター */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="企業名・担当者名で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2">
                {['all', '新規', '対応中', '見積中', '完了'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      filter === status
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {status === 'all' ? 'すべて' : status}
                  </button>
                ))}
              </div>
            </div>

            {/* リスト */}
            <div className="space-y-3">
              {filteredRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedRequest(request)}
                  className={`bg-gray-800/50 rounded-xl p-5 border cursor-pointer transition-all ${
                    selectedRequest?.id === request.id
                      ? 'border-amber-500'
                      : 'border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{request.company}</h3>
                      <p className="text-sm text-gray-400">{request.contact}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[request.status]}`}>
                        {request.status}
                      </span>
                      <span className={`text-xs ${priorityColors[request.priority]}`}>
                        ● {request.priority}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {request.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {request.requestDate}
                    </span>
                    {request.assignee && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {request.assignee}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 詳細パネル */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 sticky top-24"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedRequest.status]}`}>
                    {selectedRequest.status}
                  </span>
                  <span className="text-sm text-gray-400">{selectedRequest.plan}プラン</span>
                </div>

                <h2 className="text-xl font-bold mb-2">{selectedRequest.company}</h2>
                
                <div className="space-y-3 text-sm mb-6">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    {selectedRequest.contact}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    {selectedRequest.email}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    依頼日: {selectedRequest.requestDate}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-2">依頼内容</h3>
                  <p className="text-sm text-gray-400 bg-gray-900/50 rounded-lg p-3">
                    {selectedRequest.details}
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-2">担当者</h3>
                  {selectedRequest.assignee ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center font-bold">
                        {selectedRequest.assignee.charAt(0)}
                      </div>
                      <span>{selectedRequest.assignee}</span>
                    </div>
                  ) : (
                    <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
                      担当者を割り当てる
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                    <Mail className="w-4 h-4" />
                    メール
                  </button>
                  <button className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                    <CheckCircle className="w-4 h-4" />
                    対応完了
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700/50 text-center">
                <Target className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-500">依頼を選択して詳細を表示</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


