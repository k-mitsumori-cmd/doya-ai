'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Target, Heart, Lightbulb, Gift, Clock, Zap } from 'lucide-react'

interface PasonaStep {
  letter: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
}

const pasonaSteps: PasonaStep[] = [
  {
    letter: 'P',
    label: 'Problem',
    description: '問題',
    descriptionDetail: '「○○で悩んでいませんか?」など問題を明確化するコピー',
    icon: Target,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    letter: 'A',
    label: 'Affinity',
    description: '親近感',
    descriptionDetail: '「○○ってこういったところが大変ですよね」と読み手に寄り添う',
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    letter: 'S',
    label: 'Solution',
    description: '解決策',
    descriptionDetail: '解決策である商品・サービスを根拠や実績を添えて提示',
    icon: Lightbulb,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    letter: 'O',
    label: 'Offer',
    description: '提案',
    descriptionDetail: '商品の詳細な情報、実際の事例をしっかり伝えます',
    icon: Gift,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    letter: 'N',
    label: 'Narrow down',
    description: '絞込み',
    descriptionDetail: '限定性、緊急性のある情報で、そのまま直ちに検討してもらいます',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    letter: 'A',
    label: 'Action',
    description: '行動',
    descriptionDetail: '送料無料や特典などで行動を後押しします',
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
]

interface PasonaFrameworkViewProps {
  sections?: Array<{
    section_id: string
    section_type: string
    headline: string
    purpose: string
  }>
}

export function PasonaFrameworkView({ sections = [] }: PasonaFrameworkViewProps) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl shadow-2xl p-8 border border-slate-200">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">新PASONA の構成イメージ</h2>
            <p className="text-sm text-slate-600 mt-1">マーケティングフレームワーク</p>
          </div>
        </div>
      </div>

      {/* フレームワーク表示 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: ステージ */}
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
            ステージ
          </div>
          {[
            { label: 'FV', description: '第一印象' },
            { label: '問題提起', description: '課題の明確化' },
            { label: 'よくあるお悩み', description: '共感の獲得' },
            { label: '解決策（商品のベネフィット）', description: '価値の提示' },
            { label: '商品の特徴・価格・お客様の声', description: '詳細情報' },
            { label: '○個限定・○名様のみ・○日まで', description: '緊急性・限定性' },
            { label: 'CTA', description: '行動喚起' },
          ].map((stage, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-teal-300 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-teal-700">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{stage.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{stage.description}</div>
                </div>
                {index < 6 && (
                  <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 右側: PASONA */}
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
            PASONA フレームワーク
          </div>
          {pasonaSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.letter}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`${step.bgColor} rounded-xl p-5 border-2 border-transparent hover:border-${step.color.split('-')[1]}-300 transition-all shadow-sm hover:shadow-lg`}
              >
                <div className="flex items-start gap-4">
                  {/* アイコンと文字 */}
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl ${step.bgColor} border-4 border-white shadow-lg flex items-center justify-center`}>
                      <div className="text-center">
                        <div className={`text-2xl font-black ${step.color} mb-1`}>
                          {step.letter}
                        </div>
                        <Icon className={`w-5 h-5 ${step.color} mx-auto`} />
                      </div>
                    </div>
                  </div>

                  {/* 説明 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-black text-slate-900">{step.label}</h3>
                      <span className="text-sm font-bold text-slate-600">({step.description})</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {step.descriptionDetail}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 接続線の説明 */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-teal-500" />
          <span>左側のステージは右側のPASONAフレームワークに対応しています</span>
        </div>
      </div>
    </div>
  )
}

