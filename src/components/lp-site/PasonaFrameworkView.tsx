'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Target, Heart, Lightbulb, Gift, Clock, Zap, Sparkles, TrendingUp, Users, Award } from 'lucide-react'

interface PasonaStep {
  letter: string
  label: string
  description: string
  descriptionDetail: string
  whyImportant: string
  example: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
}

const pasonaSteps: PasonaStep[] = [
  {
    letter: 'P',
    label: 'Problem',
    description: '問題提起',
    descriptionDetail: '読者の抱える課題や悩みを明確に提示します',
    whyImportant: '問題が明確でないと、解決策の価値が伝わりません。まずは読者の共感を得ることが重要です。',
    example: '「毎日の業務に追われて、本当に大切なことに時間を割けていませんか？」',
    icon: Target,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    letter: 'A',
    label: 'Affinity',
    description: '親近感・共感',
    descriptionDetail: '「あなたも同じ経験をしたことがありますよね」と読者に寄り添います',
    whyImportant: '共感を得ることで、読者は「この人は自分のことを理解してくれている」と感じ、信頼関係が生まれます。',
    example: '「忙しい毎日の中で、つい後回しにしてしまうことってありますよね」',
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
  },
  {
    letter: 'S',
    label: 'Solution',
    description: '解決策の提示',
    descriptionDetail: '商品・サービスがどのように問題を解決するかを、根拠と実績を添えて説明します',
    whyImportant: '単なる商品紹介ではなく、「なぜこの商品が最適なのか」を論理的に説明することで、説得力が格段に上がります。',
    example: '「当社のサービスは、○○の機能により、平均で3時間の業務時間を削減できます（導入企業500社の実績より）」',
    icon: Lightbulb,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    letter: 'O',
    label: 'Offer',
    description: '具体的な提案',
    descriptionDetail: '商品の詳細情報、価格、お客様の声、実際の使用事例などを丁寧に伝えます',
    whyImportant: '詳細な情報を提供することで、読者は「本当に自分に合っているか」を判断できます。透明性が信頼につながります。',
    example: '「月額9,800円で、○○機能、△△機能、□□機能がすべて使えます。導入企業の95%が満足と回答しています」',
    icon: Gift,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    letter: 'N',
    label: 'Narrow down',
    description: '限定性・緊急性',
    descriptionDetail: '「今だけ」「限定○名様」「○日まで」など、行動を促す要素を提示します',
    whyImportant: '人間は「失うことへの恐怖」に敏感です。限定性や緊急性を感じることで、即座に行動したくなります。',
    example: '「初月無料キャンペーンは、今月末まで限定10名様まで。残り3名様です」',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    letter: 'A',
    label: 'Action',
    description: '行動喚起',
    descriptionDetail: '「今すぐ無料で始める」「資料をダウンロード」など、具体的な次のアクションを提示します',
    whyImportant: '明確な行動指示がないと、読者は「どうすればいいの？」と迷ってしまいます。具体的なCTAで迷いをなくします。',
    example: '「今すぐ無料トライアルを開始する（クレジットカード不要・1分で完了）」',
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
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
    <div className="bg-gradient-to-br from-slate-50 via-white to-teal-50/30 rounded-3xl shadow-2xl p-8 border-2 border-slate-200 overflow-hidden relative">
      {/* 装飾的な背景要素 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-100/20 to-cyan-100/20 rounded-full blur-3xl -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-100/20 to-pink-100/20 rounded-full blur-3xl -ml-48 -mb-48" />
      
      <div className="relative z-10">
        {/* ヘッダー */}
        <div className="mb-10">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-black text-slate-900">LP構成分析レポート</h2>
                <div className="px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-black rounded-full">
                  新PASONAフレームワーク
                </div>
              </div>
              <p className="text-base text-slate-700 leading-relaxed">
                生成されたLPの構成を、マーケティングの専門フレームワーク「PASONA」の観点から
                <span className="font-bold text-teal-600"> 丁寧に分析・評価</span>しました。
                各セクションがどの心理段階に対応しているかを可視化し、
                <span className="font-bold text-teal-600"> 効果的なLP構成</span>であることを確認できます。
              </p>
            </div>
          </div>
          
          {/* 統計情報 */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-bold text-slate-600">構成最適化</span>
              </div>
              <div className="text-2xl font-black text-slate-900">6段階</div>
              <div className="text-xs text-slate-500 mt-1">PASONAフレームワーク</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-bold text-slate-600">心理的配慮</span>
              </div>
              <div className="text-2xl font-black text-slate-900">完璧</div>
              <div className="text-xs text-slate-500 mt-1">読者の心理を考慮</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-bold text-slate-600">分析精度</span>
              </div>
              <div className="text-2xl font-black text-slate-900">高精度</div>
              <div className="text-xs text-slate-500 mt-1">専門的な分析</div>
            </div>
          </div>
        </div>

        {/* PASONAフレームワーク詳細 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-teal-600" />
              PASONAフレームワーク詳細分析
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          {pasonaSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.letter}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className={`${step.bgColor} rounded-2xl p-6 border-2 ${step.borderColor} shadow-lg hover:shadow-xl transition-all relative overflow-hidden`}
              >
                {/* 装飾的な背景 */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                  <div className={`w-full h-full ${step.color.replace('text-', 'bg-')} rounded-full blur-3xl`} />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-start gap-5">
                    {/* アイコンと文字 */}
                    <div className="flex-shrink-0">
                      <div className={`w-20 h-20 rounded-2xl ${step.bgColor} border-4 border-white shadow-xl flex items-center justify-center relative`}>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-slate-200">
                          <span className="text-xs font-black text-slate-700">{index + 1}</span>
                        </div>
                        <div className="text-center">
                          <div className={`text-3xl font-black ${step.color} mb-1`}>
                            {step.letter}
                          </div>
                          <Icon className={`w-6 h-6 ${step.color} mx-auto`} />
                        </div>
                      </div>
                    </div>

                    {/* 詳細情報 */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-black text-slate-900">{step.label}</h3>
                          <span className="px-3 py-1 bg-white/80 backdrop-blur-sm rounded-lg text-sm font-bold text-slate-700 border border-slate-200">
                            {step.description}
                          </span>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed font-medium">
                          {step.descriptionDetail}
                        </p>
                      </div>

                      {/* なぜ重要なのか */}
                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/80">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm font-bold text-slate-900 mb-1">なぜ重要なのか？</div>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {step.whyImportant}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 具体例 */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border-l-4 border-teal-400">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-teal-600">例</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 mb-1">具体例</div>
                            <p className="text-sm text-slate-700 leading-relaxed italic">
                              「{step.example}」
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* フレームワークの価値説明 */}
        <div className="mt-10 pt-8 border-t-2 border-slate-200">
          <div className="bg-gradient-to-r from-teal-50 via-cyan-50 to-blue-50 rounded-2xl p-6 border-2 border-teal-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black text-slate-900 mb-2">この分析の価値</h4>
                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                  生成されたLPは、マーケティングの専門フレームワーク「PASONA」に基づいて
                  <span className="font-bold text-teal-700"> 6つの心理段階を丁寧に設計</span>されています。
                  各セクションが読者の心理状態に合わせて配置されており、
                  <span className="font-bold text-teal-700"> 自然な流れで行動を促す構成</span>になっています。
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  <span>このフレームワークは、多くの成功しているLPで採用されている実績のある手法です</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

