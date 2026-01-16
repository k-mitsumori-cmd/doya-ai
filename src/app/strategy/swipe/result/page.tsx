'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StrategyAppLayout } from '@/components/StrategyAppLayout'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Calendar, DollarSign, Target, ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'

interface StrategyData {
  reason: string
  strategy_map: {
    [key: string]: Array<{
      action: string
      priority: 'high' | 'mid' | 'low'
      description: string
    }>
  }
  roadmap: {
    month1: { focus: string; actions: string[] }
    month2: { focus: string; actions: string[] }
    month3: { focus: string; actions: string[] }
  }
  budget_allocation: {
    [key: string]: number
  }
  kpi_tree: {
    final_kpi: { name: string; target: string }
    intermediate_kpis: Array<{
      name: string
      target: string
      related_actions: string[]
    }>
    action_kpis: Array<{
      name: string
      target: string
      related_actions: string[]
    }>
  }
}

export default function SwipeResultPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams.get('projectId')
  const [strategy, setStrategy] = useState<StrategyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) {
      router.push('/strategy')
      return
    }

    fetchStrategy()
  }, [projectId])

  const fetchStrategy = async () => {
    try {
      const response = await fetch(`/api/strategy/project/${projectId}`)
      if (!response.ok) throw new Error('戦略データの取得に失敗しました')
      
      const data = await response.json()
      if (data.output) {
        setStrategy(data.output as StrategyData)
      }
    } catch (error) {
      console.error('Error fetching strategy:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">戦略データを読み込み中...</p>
          </div>
        </div>
      </StrategyAppLayout>
    )
  }

  if (!strategy) {
    return (
      <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">戦略データが見つかりませんでした</p>
          <Link
            href="/strategy/swipe"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
          >
            <ArrowLeft className="w-5 h-5" />
            もう一度スワイプする
          </Link>
        </div>
      </StrategyAppLayout>
    )
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    mid: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const priorityLabels = {
    high: '高',
    mid: '中',
    low: '低',
  }

  return (
    <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">あなたのマーケティング戦略</h1>
            <p className="text-gray-600">スワイプ選択をもとに生成されました</p>
          </div>
          <Link
            href="/strategy/swipe"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
        </div>

        {/* 戦略理由 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100"
        >
          <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" />
            なぜこの戦略になったのか
          </h2>
          <p className="text-gray-700 leading-relaxed">{strategy.reason}</p>
        </motion.div>

        {/* 戦略マップ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-gray-200"
        >
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            マーケティング戦略マップ
          </h2>
          <div className="space-y-6">
            {Object.entries(strategy.strategy_map).map(([category, actions]) => (
              <div key={category}>
                <h3 className="text-lg font-bold text-slate-800 mb-3">{category}</h3>
                <div className="grid gap-3">
                  {actions.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityColors[action.priority]}`}
                      >
                        {priorityLabels[action.priority]}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{action.action}</p>
                        <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ロードマップ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-gray-200"
        >
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            3ヶ月の施策ロードマップ
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(['month1', 'month2', 'month3'] as const).map((month) => (
              <div key={month} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
                <h3 className="text-lg font-bold text-slate-900 mb-3">
                  {month === 'month1' ? '1ヶ月目' : month === 'month2' ? '2ヶ月目' : '3ヶ月目'}
                </h3>
                <p className="text-sm font-semibold text-indigo-700 mb-3">{strategy.roadmap[month].focus}</p>
                <ul className="space-y-2">
                  {strategy.roadmap[month].actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 予算配分 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-gray-200"
        >
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-indigo-600" />
            予算配分案
          </h2>
          <div className="space-y-4">
            {Object.entries(strategy.budget_allocation)
              .sort(([, a], [, b]) => b - a)
              .map(([category, percentage]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900">{category}</span>
                    <span className="text-sm font-bold text-indigo-600">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <motion.div
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: 0.4 }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </motion.div>

        {/* KPIツリー */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-gray-200"
        >
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            KPIツリー
          </h2>
          <div className="space-y-6">
            {/* 最終KPI */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">最終KPI</h3>
              <div className="flex items-center justify-between">
                <span className="text-slate-700">{strategy.kpi_tree.final_kpi.name}</span>
                <span className="text-2xl font-black text-indigo-600">{strategy.kpi_tree.final_kpi.target}</span>
              </div>
            </div>

            {/* 中間KPI */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">中間KPI</h3>
              <div className="space-y-3">
                {strategy.kpi_tree.intermediate_kpis.map((kpi, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">{kpi.name}</span>
                      <span className="text-lg font-bold text-indigo-600">{kpi.target}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">関連施策: </span>
                      {kpi.related_actions.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 施策KPI */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">施策KPI</h3>
              <div className="space-y-3">
                {strategy.kpi_tree.action_kpis.map((kpi, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">{kpi.name}</span>
                      <span className="text-lg font-bold text-indigo-600">{kpi.target}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">関連施策: </span>
                      {kpi.related_actions.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* アクションボタン */}
        <div className="flex gap-4 justify-center pt-6">
          <Link
            href="/strategy/swipe"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            もう一度スワイプする
          </Link>
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            印刷 / PDF化
          </button>
        </div>
      </div>
    </StrategyAppLayout>
  )
}
