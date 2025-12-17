'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Download,
  ArrowUpRight,
  Receipt,
  Crown,
  Building,
} from 'lucide-react'

const revenueStats = [
  { label: '今月の売上', value: '¥1,245,600', change: '+18.5%', up: true, icon: DollarSign },
  { label: 'MRR', value: '¥1,156,800', change: '+12.3%', up: true, icon: TrendingUp },
  { label: 'プレミアム会員', value: '234人', change: '+24', up: true, icon: Crown },
  { label: 'エンタープライズ', value: '12社', change: '+3', up: true, icon: Building },
]

const recentTransactions = [
  { id: 'TXN001', user: '田中 太郎', plan: 'Premium', amount: 2980, date: '2024-12-15', status: '完了' },
  { id: 'TXN002', user: '佐藤 花子', plan: 'Business', amount: 9800, date: '2024-12-15', status: '完了' },
  { id: 'TXN003', user: '株式会社ABC', plan: 'Enterprise', amount: 29800, date: '2024-12-14', status: '完了' },
  { id: 'TXN004', user: '鈴木 一郎', plan: 'Premium', amount: 2980, date: '2024-12-14', status: '完了' },
  { id: 'TXN005', user: '高橋 美咲', plan: 'Business', amount: 9800, date: '2024-12-13', status: '完了' },
]

const planDistribution = [
  { plan: 'Free', count: 1601, percentage: 87, color: 'bg-gray-500' },
  { plan: 'Premium', count: 234, percentage: 13, color: 'bg-amber-500' },
  { plan: 'Business', count: 45, percentage: 2, color: 'bg-purple-500' },
  { plan: 'Enterprise', count: 12, percentage: 1, color: 'bg-primary-500' },
]

export default function BillingPage() {
  const [period, setPeriod] = useState('month')

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">売上・課金管理</h1>
            <p className="text-gray-400 text-sm">収益とサブスクリプションの管理</p>
          </div>
          <div className="flex gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              <option value="month">今月</option>
              <option value="quarter">四半期</option>
              <option value="year">年間</option>
            </select>
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" />
              レポート出力
            </button>
          </div>
        </div>

        {/* 収益統計 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {revenueStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-green-400" />
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-green-400">
                  <ArrowUpRight className="w-4 h-4" />
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 最近の取引 */}
          <div className="lg:col-span-2 bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-5 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary-400" />
                最近の取引
              </h2>
              <button className="text-sm text-primary-400 hover:underline">すべて見る</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">取引ID</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">ユーザー</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">プラン</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400">金額</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">日付</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn) => (
                    <tr key={txn.id} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                      <td className="px-5 py-3 text-sm text-gray-300">{txn.id}</td>
                      <td className="px-5 py-3 text-sm text-white">{txn.user}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          txn.plan === 'Enterprise' ? 'bg-primary-500/20 text-primary-400' :
                          txn.plan === 'Business' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {txn.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-medium text-white">¥{txn.amount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-gray-400">{txn.date}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* プラン分布 */}
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-400" />
              プラン分布
            </h2>
            <div className="space-y-4">
              {planDistribution.map((plan) => (
                <div key={plan.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{plan.plan}</span>
                    <span className="text-sm text-gray-400">{plan.count}人</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${plan.color} rounded-full`}
                      style={{ width: `${Math.max(plan.percentage, 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">¥2,456/人</p>
                <p className="text-sm text-gray-400">平均顧客単価 (ARPU)</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}


