'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

const statsData = [
  { label: '総生成数', value: '89,432', change: '+12.5%', up: true, icon: FileText },
  { label: 'アクティブユーザー', value: '1,847', change: '+8.3%', up: true, icon: Users },
  { label: '平均セッション時間', value: '18.5分', change: '+5.2%', up: true, icon: Calendar },
  { label: '離脱率', value: '2.3%', change: '-0.5%', up: false, icon: TrendingDown },
]

const popularTemplates = [
  { name: 'ビジネスメール作成', count: 12450, percentage: 85 },
  { name: 'ブログ記事生成', count: 9820, percentage: 72 },
  { name: 'Instagram投稿', count: 8540, percentage: 65 },
  { name: 'キャッチコピー', count: 7230, percentage: 58 },
  { name: '議事録作成', count: 5890, percentage: 48 },
]

const dailyStats = [
  { date: '12/9', generations: 1120 },
  { date: '12/10', generations: 1350 },
  { date: '12/11', generations: 1180 },
  { date: '12/12', generations: 1420 },
  { date: '12/13', generations: 1580 },
  { date: '12/14', generations: 1320 },
  { date: '12/15', generations: 1256 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week')

  const maxGenerations = Math.max(...dailyStats.map(d => d.generations))

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">利用統計</h1>
            <p className="text-gray-400 text-sm">サービスの利用状況を確認</p>
          </div>
          <div className="flex gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              <option value="week">過去7日</option>
              <option value="month">過去30日</option>
              <option value="year">過去1年</option>
            </select>
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" />
              エクスポート
            </button>
            <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
              <RefreshCw className="w-4 h-4" />
              更新
            </button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-primary-400" />
                </div>
                <span className={`flex items-center gap-1 text-sm font-medium ${stat.up ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 日次生成数グラフ */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-400" />
              日次生成数
            </h2>
            <div className="flex items-end gap-3 h-48">
              {dailyStats.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t-lg transition-all hover:from-primary-400 hover:to-primary-300"
                    style={{ height: `${(day.generations / maxGenerations) * 100}%` }}
                  />
                  <span className="text-xs text-gray-400">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 人気テンプレート */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-400" />
              人気テンプレート
            </h2>
            <div className="space-y-4">
              {popularTemplates.map((template, index) => (
                <div key={template.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{index + 1}. {template.name}</span>
                    <span className="text-sm text-gray-400">{template.count.toLocaleString()}回</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                      style={{ width: `${template.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}


