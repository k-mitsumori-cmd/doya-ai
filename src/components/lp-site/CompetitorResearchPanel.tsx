'use client'

import { LpGenerationResult } from '@/lib/lp-site/types'
import { ExternalLink } from 'lucide-react'

interface CompetitorResearchPanelProps {
  competitorResearch?: LpGenerationResult['competitor_research']
}

export function CompetitorResearchPanel({ competitorResearch }: CompetitorResearchPanelProps) {
  if (!competitorResearch || !competitorResearch.competitors || competitorResearch.competitors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-slate-400 text-sm mb-2">競合調査データがありません</div>
          <div className="text-xs text-slate-500">URL入力から商品情報を解析した際に、競合調査が自動的に実行されます</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* サマリー */}
      {competitorResearch.summary && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="text-xs font-bold text-blue-900 mb-2">競合分析サマリー</div>
          <div className="text-xs text-blue-800 leading-relaxed">{competitorResearch.summary}</div>
        </div>
      )}

      {/* 差別化戦略 */}
      {competitorResearch.differentiation_strategy && (
        <div className="mb-6 p-4 bg-teal-50 rounded-xl border border-teal-200">
          <div className="text-xs font-bold text-teal-900 mb-2">差別化戦略</div>
          <div className="text-xs text-teal-800 leading-relaxed">{competitorResearch.differentiation_strategy}</div>
        </div>
      )}

      {/* 競合サービス一覧 */}
      <div className="space-y-4">
        <div className="text-xs font-bold text-slate-900 mb-3">類似サービス ({competitorResearch.competitors.length}件)</div>
        {competitorResearch.competitors.map((competitor, index) => (
          <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm font-bold text-slate-900">{competitor.service_name}</div>
              {competitor.service_url && (
                <a
                  href={competitor.service_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            
            {/* 特徴 */}
            {competitor.features && competitor.features.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">特徴</div>
                <ul className="space-y-1">
                  {competitor.features.map((feature, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-teal-600 mt-0.5">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* LP内容 */}
            {competitor.lp_content && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">LPの主な内容</div>
                <div className="text-xs text-slate-600 leading-relaxed">{competitor.lp_content}</div>
              </div>
            )}

            {/* 強み */}
            {competitor.strengths && competitor.strengths.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">強み</div>
                <ul className="space-y-1">
                  {competitor.strengths.map((strength, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 差別化ポイント */}
            {competitor.differentiation_points && competitor.differentiation_points.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">差別化ポイント</div>
                <ul className="space-y-1">
                  {competitor.differentiation_points.map((point, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-orange-600 mt-0.5">★</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

