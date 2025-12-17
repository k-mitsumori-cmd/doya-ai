'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase,
  Plus,
  Search,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  MoreVertical,
  Phone,
  Mail,
  Building,
} from 'lucide-react'

type CaseStatus = '商談中' | '提案中' | '契約中' | '完了' | '保留'

interface ConsultingCase {
  id: string
  company: string
  contact: string
  email: string
  phone: string
  service: string
  amount: number
  status: CaseStatus
  startDate: string
  nextAction: string
  priority: 'high' | 'medium' | 'low'
}

const consultingCases: ConsultingCase[] = [
  {
    id: 'CS001',
    company: '株式会社テックイノベーション',
    contact: '山田 太郎',
    email: 'yamada@tech-innovation.co.jp',
    phone: '03-1234-5678',
    service: 'LP制作 + 広告運用',
    amount: 500000,
    status: '商談中',
    startDate: '2024-12-10',
    nextAction: '見積もり提出',
    priority: 'high',
  },
  {
    id: 'CS002',
    company: '合同会社グロースハック',
    contact: '佐藤 花子',
    email: 'sato@growthhack.jp',
    phone: '06-9876-5432',
    service: 'SNS運用代行',
    amount: 300000,
    status: '提案中',
    startDate: '2024-12-08',
    nextAction: 'プレゼン準備',
    priority: 'medium',
  },
  {
    id: 'CS003',
    company: '株式会社マーケティングプロ',
    contact: '鈴木 一郎',
    email: 'suzuki@marketing-pro.com',
    phone: '052-1111-2222',
    service: 'Webサイト制作',
    amount: 800000,
    status: '契約中',
    startDate: '2024-12-01',
    nextAction: 'デザイン確認',
    priority: 'high',
  },
  {
    id: 'CS004',
    company: '有限会社セールスブースト',
    contact: '高橋 美咲',
    email: 'takahashi@salesboost.jp',
    phone: '03-5555-6666',
    service: '営業資料作成',
    amount: 150000,
    status: '完了',
    startDate: '2024-11-15',
    nextAction: '-',
    priority: 'low',
  },
]

const statusConfig: Record<CaseStatus, { color: string; icon: any }> = {
  '商談中': { color: 'bg-blue-500/20 text-blue-400', icon: PlayCircle },
  '提案中': { color: 'bg-purple-500/20 text-purple-400', icon: Clock },
  '契約中': { color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  '完了': { color: 'bg-gray-500/20 text-gray-400', icon: CheckCircle },
  '保留': { color: 'bg-amber-500/20 text-amber-400', icon: AlertCircle },
}

export default function ConsultingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all')

  const filteredCases = consultingCases.filter((c) => {
    const matchesSearch =
      c.company.includes(searchQuery) ||
      c.contact.includes(searchQuery) ||
      c.service.includes(searchQuery)
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalAmount = consultingCases
    .filter((c) => c.status !== '完了')
    .reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">コンサル案件管理</h1>
            <p className="text-gray-400 text-sm">マーケティング支援の案件を一元管理</p>
          </div>
          <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" />
            新規案件登録
          </button>
        </div>

        {/* サマリーカード */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <p className="text-sm text-gray-400 mb-1">進行中の案件</p>
            <p className="text-2xl font-bold text-white">
              {consultingCases.filter((c) => c.status !== '完了').length}件
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <p className="text-sm text-gray-400 mb-1">見込み売上</p>
            <p className="text-2xl font-bold text-green-400">
              ¥{totalAmount.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <p className="text-sm text-gray-400 mb-1">商談中</p>
            <p className="text-2xl font-bold text-blue-400">
              {consultingCases.filter((c) => c.status === '商談中').length}件
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <p className="text-sm text-gray-400 mb-1">今月完了</p>
            <p className="text-2xl font-bold text-purple-400">
              {consultingCases.filter((c) => c.status === '完了').length}件
            </p>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="会社名、担当者、サービスで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="all">全ステータス</option>
            <option value="商談中">商談中</option>
            <option value="提案中">提案中</option>
            <option value="契約中">契約中</option>
            <option value="完了">完了</option>
            <option value="保留">保留</option>
          </select>
        </div>

        {/* 案件リスト */}
        <div className="space-y-4">
          {filteredCases.map((caseItem, index) => {
            const StatusIcon = statusConfig[caseItem.status].icon
            return (
              <motion.div
                key={caseItem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 hover:border-primary-500/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* 会社情報 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <Building className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{caseItem.company}</h3>
                        <p className="text-sm text-gray-400">{caseItem.service}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {caseItem.contact}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {caseItem.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {caseItem.phone}
                      </span>
                    </div>
                  </div>

                  {/* ステータス・金額 */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">
                        ¥{caseItem.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">見積金額</p>
                    </div>
                    <div className="text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusConfig[caseItem.status].color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {caseItem.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        次: {caseItem.nextAction}
                      </p>
                    </div>
                    <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {filteredCases.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>該当する案件が見つかりません</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}


