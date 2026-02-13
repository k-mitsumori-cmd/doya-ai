'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

// ===== 7軸ディメンション定義 =====
const DIMENSIONS = [
  { key: 'tracking', label: '広告・トラッキング', icon: 'campaign', color: 'blue', scoreField: 'trackingScore' },
  { key: 'appealAxis', label: '訴求軸', icon: 'ads_click', color: 'violet', scoreField: 'appealScore' },
  { key: 'socialProof', label: '社会的証明', icon: 'groups', color: 'amber', scoreField: 'socialProofScore' },
  { key: 'ctaAnalysis', label: 'CTA設計', icon: 'touch_app', color: 'emerald', scoreField: 'ctaEffectivenessScore' },
  { key: 'pricingSignals', label: '料金透明性', icon: 'payments', color: 'cyan', scoreField: 'pricingTransparencyScore' },
  { key: 'contentMarketing', label: 'コンテンツ戦略', icon: 'article', color: 'purple', scoreField: 'contentDepthScore' },
  { key: 'competitivePositioning', label: '競争ポジショニング', icon: 'military_tech', color: 'red', scoreField: 'positioningScore' },
] as const

// ===== カラーユーティリティ =====
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; barBg: string; scoreBg: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    barBg: 'bg-blue-500',    scoreBg: 'bg-blue-50' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200',  barBg: 'bg-violet-500',  scoreBg: 'bg-violet-50' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   barBg: 'bg-amber-500',   scoreBg: 'bg-amber-50' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', barBg: 'bg-emerald-500', scoreBg: 'bg-emerald-50' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    border: 'border-cyan-200',    barBg: 'bg-cyan-500',    scoreBg: 'bg-cyan-50' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200',  barBg: 'bg-purple-500',  scoreBg: 'bg-purple-50' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',     barBg: 'bg-red-500',     scoreBg: 'bg-red-50' },
}

// ===== 比較キーのマッピング =====
const COMPARISON_KEY_MAP: Record<string, string> = {
  tracking: 'trackingComparison',
  appealAxis: 'appealAxisComparison',
  socialProof: 'socialProofComparison',
  ctaAnalysis: 'ctaComparison',
  pricingSignals: 'pricingComparison',
  contentMarketing: 'contentComparison',
  competitivePositioning: 'overallWebPositioning',
}

// ===== Props =====
interface CompetitiveMatrixProps {
  websiteHealth: any
  competitors: any[]
  detailedComparison?: {
    trackingComparison: string
    appealAxisComparison: string
    socialProofComparison: string
    ctaComparison: string
    pricingComparison: string
    contentComparison: string
    overallWebPositioning: string
  } | null
}

// ===== ヘルパー: スコア取得 =====
function getScore(data: any, dim: typeof DIMENSIONS[number]): number | null {
  const dimData = data?.[dim.key]
  if (!dimData) return null
  return dimData[dim.scoreField] ?? null
}

// ===== ヘルパー: ホスト名取得 =====
function getHostname(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

// ===== ディメンション別 詳細レンダラー =====
function DimensionDetail({ dimKey, selfData, compData, compUrl }: { dimKey: string; selfData: any; compData: any; compUrl: string }) {
  if (dimKey === 'tracking') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.detectedTools?.length > 0
              ? selfData.detectedTools.map((t: string, i: number) => (
                  <span key={i} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">{t}</span>
                ))
              : <span className="text-[10px] text-gray-400">未検出</span>
            }
          </div>
          {selfData?.maturityLevel && (
            <p className="text-[10px] text-gray-400 mt-1">成熟度: {selfData.maturityLevel}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5">
            {compData?.detectedTools?.length > 0
              ? compData.detectedTools.map((t: string, i: number) => (
                  <span key={i} className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{t}</span>
                ))
              : <span className="text-[10px] text-gray-400">未検出</span>
            }
          </div>
          {compData?.maturityLevel && (
            <p className="text-[10px] text-gray-400 mt-1">成熟度: {compData.maturityLevel}</p>
          )}
        </div>
      </div>
    )
  }

  if (dimKey === 'appealAxis') {
    const heroTypeLabel = (type: string) =>
      type === 'benefit' ? 'ベネフィット訴求'
        : type === 'feature' ? 'フィーチャー訴求'
        : type === 'emotional' ? '感情訴求'
        : type === 'social-proof' ? '実績訴求'
        : '訴求不明確'
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          {selfData?.heroText && (
            <p className="text-xs text-gray-600 italic mb-1.5">&quot;{selfData.heroText.slice(0, 80)}&quot;</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {selfData?.heroType && (
              <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                {heroTypeLabel(selfData.heroType)}
              </span>
            )}
            {selfData?.uspKeywords?.slice(0, 3).map((kw: string, i: number) => (
              <span key={i} className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">{kw}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          {compData?.heroText && (
            <p className="text-xs text-gray-600 italic mb-1.5">&quot;{compData.heroText.slice(0, 80)}&quot;</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {compData?.heroType && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
                {heroTypeLabel(compData.heroType)}
              </span>
            )}
            {compData?.uspKeywords?.slice(0, 3).map((kw: string, i: number) => (
              <span key={i} className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{kw}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (dimKey === 'socialProof') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.proofElements?.length > 0
              ? selfData.proofElements.map((el: string, i: number) => (
                  <span key={i} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">{el}</span>
                ))
              : <span className="text-[10px] text-gray-400">未検出</span>
            }
          </div>
          {selfData?.userCountText && (
            <p className="text-[10px] text-gray-500 mt-1">ユーザー数表記: {selfData.userCountText}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5">
            {compData?.proofElements?.length > 0
              ? compData.proofElements.map((el: string, i: number) => (
                  <span key={i} className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{el}</span>
                ))
              : <span className="text-[10px] text-gray-400">未検出</span>
            }
          </div>
          {compData?.userCountText && (
            <p className="text-[10px] text-gray-500 mt-1">ユーザー数表記: {compData.userCountText}</p>
          )}
        </div>
      </div>
    )
  }

  if (dimKey === 'ctaAnalysis') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {selfData?.ctaTexts?.slice(0, 4).map((cta: string, i: number) => (
              <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">{cta}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.ctaPlacement && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">配置: {selfData.ctaPlacement}</span>
            )}
            {selfData?.hasLeadMagnet && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">リードマグネット</span>
            )}
            {selfData?.hasLiveChat && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">チャット</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {compData?.ctaTexts?.slice(0, 4).map((cta: string, i: number) => (
              <span key={i} className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{cta}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {compData?.ctaPlacement && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">配置: {compData.ctaPlacement}</span>
            )}
            {compData?.hasLeadMagnet && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">リードマグネット</span>
            )}
            {compData?.hasLiveChat && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">チャット</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (dimKey === 'pricingSignals') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.pricingModel && (
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">{selfData.pricingModel}</span>
            )}
            {selfData?.hasFreeTrial && (
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">無料トライアル</span>
            )}
            {selfData?.hasPricingPage && (
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">料金ページ有</span>
            )}
            {selfData?.priceIndicators?.map((p: string, i: number) => (
              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5">
            {compData?.pricingModel && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{compData.pricingModel}</span>
            )}
            {compData?.hasFreeTrial && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">無料トライアル</span>
            )}
            {compData?.hasPricingPage && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">料金ページ有</span>
            )}
            {compData?.priceIndicators?.map((p: string, i: number) => (
              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{p}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (dimKey === 'contentMarketing') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.contentTypes?.map((ct: string, i: number) => (
              <span key={i} className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{ct}</span>
            ))}
            {selfData?.hasNewsletterSignup && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">ニュースレター</span>
            )}
            {selfData?.hasVideo && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">動画</span>
            )}
          </div>
          {selfData?.topicClusters?.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">トピック</p>
              <div className="flex flex-wrap gap-1">
                {selfData.topicClusters.slice(0, 4).map((tc: string, i: number) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{tc}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5">
            {compData?.contentTypes?.map((ct: string, i: number) => (
              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{ct}</span>
            ))}
            {compData?.hasNewsletterSignup && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">ニュースレター</span>
            )}
            {compData?.hasVideo && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">動画</span>
            )}
          </div>
          {compData?.topicClusters?.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">トピック</p>
              <div className="flex flex-wrap gap-1">
                {compData.topicClusters.slice(0, 4).map((tc: string, i: number) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{tc}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (dimKey === 'competitivePositioning') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">自社</p>
          <div className="flex flex-wrap gap-1.5">
            {selfData?.positioningType && (
              <span className="text-[10px] bg-red-500/10 text-red-600 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">{selfData.positioningType}</span>
            )}
            {selfData?.hasComparisonPage && (
              <span className="text-[10px] bg-red-500/10 text-red-600 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">比較ページ有</span>
            )}
          </div>
          {selfData?.differentiationClaims?.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">差別化ポイント</p>
              <div className="flex flex-wrap gap-1">
                {selfData.differentiationClaims.slice(0, 3).map((dc: string, i: number) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{dc}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-600 mb-1.5">{getHostname(compUrl)}</p>
          <div className="flex flex-wrap gap-1.5">
            {compData?.positioningType && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">{compData.positioningType}</span>
            )}
            {compData?.hasComparisonPage && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">比較ページ有</span>
            )}
          </div>
          {compData?.differentiationClaims?.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">差別化ポイント</p>
              <div className="flex flex-wrap gap-1">
                {compData.differentiationClaims.slice(0, 3).map((dc: string, i: number) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{dc}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ===== メインコンポーネント =====
export default function CompetitiveMatrix({ websiteHealth, competitors, detailedComparison }: CompetitiveMatrixProps) {
  const [expandedDim, setExpandedDim] = useState<string | null>(null)

  // 有効なディメンションのみフィルタ
  const activeDimensions = DIMENSIONS.filter((dim) => websiteHealth?.[dim.key])

  if (activeDimensions.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h3 className="text-lg font-black flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-teal-600" style={{ fontSize: 20 }}>
            analytics
          </span>
          <span className="text-gray-900">詳細競合分析マトリクス</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-600 border border-teal-200">
            7軸分析
          </span>
        </h3>
        <p className="text-xs text-gray-400">自社サイトと競合サイトの多角的な比較分析</p>
      </div>

      {/* スコア概要: 横並びスコアサークル */}
      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        {activeDimensions.map((dim, idx) => {
          const score = getScore(websiteHealth, dim)
          const colors = COLOR_MAP[dim.color]
          return (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * idx }}
              className="flex flex-col items-center gap-1"
            >
              <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ${colors.scoreBg} border ${colors.border}`}>
                <span className={`text-sm font-black ${colors.text}`}>{score ?? '-'}</span>
              </div>
              <span className="text-[9px] font-bold text-gray-400 text-center max-w-[60px] leading-tight">{dim.label}</span>
            </motion.div>
          )
        })}
      </div>

      {/* ディメンション展開セクション */}
      <div className="space-y-2">
        {activeDimensions.map((dim, idx) => {
          const selfScore = getScore(websiteHealth, dim)
          const colors = COLOR_MAP[dim.color]
          const isExpanded = expandedDim === dim.key
          const compKey = COMPARISON_KEY_MAP[dim.key]
          const commentary = detailedComparison ? (detailedComparison as any)[compKey] : null

          return (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              {/* ヘッダー行 (クリックで展開) */}
              <button
                onClick={() => setExpandedDim(isExpanded ? null : dim.key)}
                className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 transition-all group"
              >
                <span className={`material-symbols-outlined ${colors.text}`} style={{ fontSize: 18 }}>
                  {dim.icon}
                </span>
                <span className="text-sm font-bold text-gray-900 flex-shrink-0">{dim.label}</span>

                {/* スコアバー */}
                <div className="flex-1 flex items-center gap-2 mx-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selfScore ?? 0}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 }}
                      className={`h-full rounded-full ${colors.barBg}`}
                    />
                  </div>
                  <span className={`text-sm font-black ${colors.text} w-8 text-right`}>{selfScore ?? '-'}</span>
                </div>

                {/* 展開アイコン */}
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="material-symbols-outlined text-gray-400 group-hover:text-gray-600 transition-colors"
                  style={{ fontSize: 18 }}
                >
                  expand_more
                </motion.span>
              </button>

              {/* 展開コンテンツ */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-1 space-y-4">
                      {/* 競合ごとの比較 */}
                      {competitors.length > 0 ? (
                        <div className="space-y-4">
                          {competitors.map((comp, ci) => {
                            const compDimData = comp[dim.key]
                            const compScore = compDimData?.[dim.scoreField] ?? null
                            const selfDimData = websiteHealth[dim.key]

                            return (
                              <div key={ci}>
                                {/* 競合スコア比較バー */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 w-28 truncate">{getHostname(comp.url)}</span>
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${compScore ?? 0}%` }} />
                                  </div>
                                  <span className={`text-xs font-black w-8 text-right ${
                                    compScore != null && selfScore != null
                                      ? compScore > selfScore ? 'text-red-600' : 'text-gray-600'
                                      : 'text-gray-500'
                                  }`}>
                                    {compScore ?? '-'}
                                  </span>
                                </div>

                                {/* ディメンション別詳細 */}
                                <DimensionDetail
                                  dimKey={dim.key}
                                  selfData={selfDimData}
                                  compData={compDimData}
                                  compUrl={comp.url}
                                />

                                {ci < competitors.length - 1 && (
                                  <div className="border-t border-gray-200 mt-3" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">競合データがありません</p>
                      )}

                      {/* AI比較コメンタリー */}
                      {commentary && (
                        <div className={`${colors.bg} border ${colors.border} rounded-xl p-3 mt-3`}>
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-teal-600 flex-shrink-0" style={{ fontSize: 16 }}>
                              smart_toy
                            </span>
                            <div>
                              <p className="text-[10px] font-bold text-teal-600 mb-0.5">AI分析コメント</p>
                              <p className="text-xs text-gray-600 leading-relaxed">{commentary}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* 全体Web ポジショニングコメンタリー */}
      {detailedComparison?.overallWebPositioning && (
        <div className="mt-6 bg-teal-50/50 border border-teal-200 rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-teal-600 flex-shrink-0" style={{ fontSize: 20 }}>
              insights
            </span>
            <div>
              <p className="text-xs font-bold text-teal-600 mb-1">総合Webポジショニング</p>
              <p className="text-sm text-gray-600 leading-relaxed">{detailedComparison.overallWebPositioning}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
