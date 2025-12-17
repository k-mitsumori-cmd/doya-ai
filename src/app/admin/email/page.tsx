'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mail,
  Plus,
  Search,
  Send,
  Clock,
  CheckCircle,
  Users,
  FileText,
  BarChart3,
  Eye,
  MousePointer,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react'

type EmailStatus = '下書き' | '予約済み' | '送信済み'

interface EmailCampaign {
  id: string
  subject: string
  status: EmailStatus
  targetAudience: string
  recipientCount: number
  sentAt: string | null
  scheduledAt: string | null
  openRate: number | null
  clickRate: number | null
}

const emailCampaigns: EmailCampaign[] = [
  {
    id: 'EM001',
    subject: '【DOYA-AI】12月の新機能のお知らせ',
    status: '送信済み',
    targetAudience: '全ユーザー',
    recipientCount: 1892,
    sentAt: '2024-12-10 10:00',
    scheduledAt: null,
    openRate: 42.5,
    clickRate: 8.3,
  },
  {
    id: 'EM002',
    subject: '【限定】プレミアムプラン30%OFFキャンペーン',
    status: '送信済み',
    targetAudience: '無料ユーザー',
    recipientCount: 1601,
    sentAt: '2024-12-08 14:00',
    scheduledAt: null,
    openRate: 38.2,
    clickRate: 12.1,
  },
  {
    id: 'EM003',
    subject: '【お知らせ】年末年始の営業について',
    status: '予約済み',
    targetAudience: '全ユーザー',
    recipientCount: 1892,
    sentAt: null,
    scheduledAt: '2024-12-25 09:00',
    openRate: null,
    clickRate: null,
  },
  {
    id: 'EM004',
    subject: '活用事例：売上150%アップの秘訣',
    status: '下書き',
    targetAudience: 'Businessプラン',
    recipientCount: 45,
    sentAt: null,
    scheduledAt: null,
    openRate: null,
    clickRate: null,
  },
]

const statusConfig: Record<EmailStatus, { color: string; icon: any }> = {
  '下書き': { color: 'bg-gray-500/20 text-gray-400', icon: FileText },
  '予約済み': { color: 'bg-amber-500/20 text-amber-400', icon: Clock },
  '送信済み': { color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
}

export default function EmailPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'all'>('all')

  const filteredCampaigns = emailCampaigns.filter((campaign) => {
    const matchesSearch = campaign.subject.includes(searchQuery)
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalSent = emailCampaigns.filter((c) => c.status === '送信済み').length
  const avgOpenRate =
    emailCampaigns
      .filter((c) => c.openRate !== null)
      .reduce((sum, c) => sum + (c.openRate || 0), 0) /
    emailCampaigns.filter((c) => c.openRate !== null).length

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">メール配信管理</h1>
            <p className="text-gray-400 text-sm">ニュースレター・キャンペーンメールの管理</p>
          </div>
          <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" />
            新規メール作成
          </button>
        </div>

        {/* 統計カード */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalSent}</p>
                <p className="text-sm text-gray-400">送信済みキャンペーン</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{avgOpenRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-400">平均開封率</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">1,892</p>
                <p className="text-sm text-gray-400">総購読者数</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {emailCampaigns.filter((c) => c.status === '予約済み').length}
                </p>
                <p className="text-sm text-gray-400">予約中</p>
              </div>
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="件名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmailStatus | 'all')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="all">全ステータス</option>
            <option value="下書き">下書き</option>
            <option value="予約済み">予約済み</option>
            <option value="送信済み">送信済み</option>
          </select>
        </div>

        {/* メール一覧 */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">件名</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">対象</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">受信者</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">ステータス</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">開封率</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">クリック率</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => {
                const StatusIcon = statusConfig[campaign.status].icon
                return (
                  <tr key={campaign.id} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="px-5 py-4">
                      <p className="text-sm text-white font-medium">{campaign.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {campaign.sentAt
                          ? `送信: ${campaign.sentAt}`
                          : campaign.scheduledAt
                          ? `予約: ${campaign.scheduledAt}`
                          : '未設定'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{campaign.targetAudience}</td>
                    <td className="px-5 py-4 text-center text-sm text-white">
                      {campaign.recipientCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[campaign.status].color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {campaign.openRate !== null ? (
                        <span className="text-sm text-green-400">{campaign.openRate}%</span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {campaign.clickRate !== null ? (
                        <span className="text-sm text-blue-400">{campaign.clickRate}%</span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="編集">
                          <Edit className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="複製">
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1.5 hover:bg-red-500/20 rounded transition-colors" title="削除">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>該当するメールが見つかりません</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}


