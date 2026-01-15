'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BarChart3, Target, TrendingUp, DollarSign, RefreshCw, Download } from 'lucide-react'
import { StrategyProject } from '@prisma/client'

interface StrategyDetailViewProps {
  project: StrategyProject
}

export function StrategyDetailView({ project }: StrategyDetailViewProps) {
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const coreStrategy = project.coreStrategy as any
  const phases = project.phases as any
  const visualizationData = project.visualizationData as any
  const externalResearch = project.externalResearch as any

  const handleRegenerate = async (step: 'phase' | 'visualization' | 'external-research') => {
    setRegenerating(step)
    try {
      const body: any = { step, projectId: project.id }
      
      if (step === 'phase' && coreStrategy) {
        body.coreStrategy = coreStrategy
      } else if (step === 'visualization' && phases) {
        body.phases = phases
      } else if (step === 'external-research') {
        body.productInfo = {
          serviceUrl: project.serviceUrl,
          businessModel: project.businessModel,
          targetCustomer: project.targetCustomer,
        }
      }

      const response = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('再生成に失敗しました')
      }

      // ページをリロード
      window.location.reload()
    } catch (error: any) {
      alert(error.message || '再生成に失敗しました')
      setRegenerating(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/strategy"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">
              {project.title || '無題の戦略'}
            </h1>
            <p className="text-sm text-slate-600">
              {new Date(project.createdAt).toLocaleDateString('ja-JP')} 作成
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              project.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-700'
                : project.status === 'GENERATED'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            {project.status === 'COMPLETED' ? '完了' : project.status === 'GENERATED' ? '生成済み' : '下書き'}
          </span>
        </div>
      </div>

      {/* Core Strategy */}
      {coreStrategy && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-600" />
              コア戦略
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-600 mb-1">戦略タイプ</p>
              <p className="text-lg font-black text-slate-900">{coreStrategy.core_strategy}</p>
            </div>
            {coreStrategy.main_levers && coreStrategy.main_levers.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">主要施策</p>
                <div className="flex flex-wrap gap-2">
                  {coreStrategy.main_levers.map((lever: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold"
                    >
                      {lever}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Phases */}
      {phases && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              フェーズ別戦略
            </h2>
            <button
              onClick={() => handleRegenerate('phase')}
              disabled={regenerating === 'phase'}
              className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating === 'phase' ? 'animate-spin' : ''}`} />
              再生成
            </button>
          </div>
          <div className="space-y-6">
            {Object.entries(phases).map(([phaseKey, phase]: [string, any], index) => (
              <div key={phaseKey} className="border-l-4 border-indigo-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-black text-indigo-600">Phase {index + 1}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {phase.budget_ratio}% の予算
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{phase.goal}</h3>
                {phase.actions && phase.actions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-600 mb-2">主要施策</p>
                    <ul className="space-y-1">
                      {phase.actions.map((action: string, i: number) => (
                        <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {phase.kpi && phase.kpi.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-600 mb-2">KPI</p>
                    <div className="flex flex-wrap gap-2">
                      {phase.kpi.map((kpi: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold"
                        >
                          {kpi}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Visualization */}
      {visualizationData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              可視化データ
            </h2>
            <button
              onClick={() => handleRegenerate('visualization')}
              disabled={regenerating === 'visualization'}
              className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating === 'visualization' ? 'animate-spin' : ''}`} />
              再生成
            </button>
          </div>
          <div className="space-y-6">
            {visualizationData.budget_chart && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-3">予算配分</p>
                <div className="space-y-2">
                  {visualizationData.budget_chart.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-semibold text-slate-700">{item.name}</div>
                      <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-end pr-2"
                          style={{ width: `${item.value}%` }}
                        >
                          <span className="text-xs font-black text-white">{item.value}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {visualizationData.kpi_chart && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-3">KPI一覧</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visualizationData.kpi_chart.map((item: any, index: number) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-lg font-black text-indigo-600">{item.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.phase}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* External Research */}
      {externalResearch && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-600" />
              外部調査結果
            </h2>
            <button
              onClick={() => handleRegenerate('external-research')}
              disabled={regenerating === 'external-research'}
              className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating === 'external-research' ? 'animate-spin' : ''}`} />
              再生成
            </button>
          </div>
          <div className="space-y-4">
            {externalResearch.summary && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">傾向まとめ</p>
                <p className="text-sm text-slate-700 leading-relaxed">{externalResearch.summary}</p>
              </div>
            )}
            {externalResearch.patterns && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">共通パターン</p>
                <div className="space-y-3">
                  {externalResearch.patterns.common_channels && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">共通チャネル</p>
                      <div className="flex flex-wrap gap-2">
                        {externalResearch.patterns.common_channels.map((channel: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold"
                          >
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {externalResearch.patterns.common_strategies && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">共通施策</p>
                      <div className="flex flex-wrap gap-2">
                        {externalResearch.patterns.common_strategies.map((strategy: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold"
                          >
                            {strategy}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!coreStrategy && !phases && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">戦略データがありません</h3>
          <p className="text-sm text-slate-600 mb-6">戦略を生成してください</p>
          <Link
            href="/strategy/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            戦略を作成する
          </Link>
        </div>
      )}
    </div>
  )
}
