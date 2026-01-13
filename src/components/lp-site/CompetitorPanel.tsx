'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  ExternalLink,
  Target,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Building2,
  Sparkles,
} from 'lucide-react'

interface CompetitorInfo {
  service_name: string
  service_url?: string
  features: string[]
  lp_content?: string
  strengths?: string[]
  differentiation_points?: string[]
}

interface CompetitorResearchResult {
  competitors: CompetitorInfo[]
  summary?: string
  differentiation_strategy?: string
}

interface CompetitorPanelProps {
  competitorResearch?: CompetitorResearchResult
  isLoading?: boolean
  productName?: string
}

export function CompetitorPanel({ competitorResearch, isLoading, productName }: CompetitorPanelProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Search className="w-5 h-5 text-amber-600" />
            </motion.div>
            <h3 className="text-sm font-bold text-slate-900">競合調査中...</h3>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-32 mb-2 animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded w-48 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded w-3/4 animate-pulse" />
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              <p className="text-xs font-bold text-amber-700">
                類似サービスを検索し、競合情報を分析しています...
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!competitorResearch || competitorResearch.competitors.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 mb-2">競合情報がありません</h3>
        <p className="text-xs text-slate-500">
          LP生成時に競合調査が実行されます
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">競合分析</h3>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">
            {competitorResearch.competitors.length}社
          </span>
        </div>
        {productName && (
          <p className="text-xs text-slate-600">
            「{productName}」の競合サービス
          </p>
        )}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* サマリー */}
        {competitorResearch.summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-blue-900">競合分析サマリー</h4>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {competitorResearch.summary}
            </p>
          </motion.div>
        )}

        {/* 差別化戦略 */}
        {competitorResearch.differentiation_strategy && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-green-600" />
              <h4 className="text-xs font-bold text-green-900">差別化戦略の提案</h4>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {competitorResearch.differentiation_strategy}
            </p>
          </motion.div>
        )}

        {/* 競合リスト */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            競合サービス一覧
          </h4>
          {competitorResearch.competitors.map((competitor, index) => (
            <motion.div
              key={competitor.service_name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              {/* サービス名とURL */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{competitor.service_name}</h5>
                    {competitor.service_url && (
                      <a
                        href={competitor.service_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        サイトを見る
                      </a>
                    )}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded">
                  #{index + 1}
                </span>
              </div>

              {/* 特徴 */}
              {competitor.features && competitor.features.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-teal-500" />
                    主な特徴
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {competitor.features.slice(0, 5).map((feature, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded-lg border border-teal-100"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LP内容 */}
              {competitor.lp_content && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-slate-600 mb-1.5">LP訴求ポイント</div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2 border border-slate-100">
                    {competitor.lp_content}
                  </p>
                </div>
              )}

              {/* 強み */}
              {competitor.strengths && competitor.strengths.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    強み
                  </div>
                  <ul className="space-y-1">
                    {competitor.strengths.slice(0, 3).map((strength, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 差別化ポイント */}
              {competitor.differentiation_points && competitor.differentiation_points.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    差別化ポイント
                  </div>
                  <ul className="space-y-1">
                    {competitor.differentiation_points.slice(0, 3).map((point, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

