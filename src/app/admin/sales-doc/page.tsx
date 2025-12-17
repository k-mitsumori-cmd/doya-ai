'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Building,
  Target,
  Users,
  Briefcase,
  TrendingUp,
  Award,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const documentTypes = [
  { id: 'proposal', name: '提案書', icon: FileText, desc: '課題解決型の提案書' },
  { id: 'company', name: '会社紹介資料', icon: Building, desc: '会社概要・実績紹介' },
  { id: 'service', name: 'サービス紹介', icon: Award, desc: 'サービス詳細説明' },
  { id: 'case', name: '事例集', icon: TrendingUp, desc: '導入事例まとめ' },
]

const sampleSlides = [
  { title: '表紙', content: 'DOYA-AI ご提案資料\n〜AIでマーケティング業務を革新〜' },
  { title: '課題', content: '・コンテンツ作成に時間がかかる\n・プロンプト作成が難しい\n・品質にばらつきがある' },
  { title: '解決策', content: 'DOYA-AIなら\n✓ テンプレートを選ぶだけ\n✓ 68種類の専門テンプレート\n✓ プロ品質のアウトプット' },
  { title: '導入効果', content: '作業時間 75%削減\nコンテンツ数 2倍\n満足度 98%' },
  { title: '料金プラン', content: 'Free: ¥0\nPremium: ¥2,980/月\nBusiness: ¥9,800/月\nEnterprise: ¥30,000/月' },
  { title: 'お問い合わせ', content: '株式会社DOYA\nEmail: support@doya-ai.com\nTel: 03-XXXX-XXXX' },
]

export default function SalesDocPage() {
  const [selectedType, setSelectedType] = useState('proposal')
  const [clientName, setClientName] = useState('')
  const [clientIndustry, setClientIndustry] = useState('')
  const [painPoints, setPainPoints] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [slides, setSlides] = useState<typeof sampleSlides | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSlides(sampleSlides)
    setIsGenerating(false)
    toast.success('営業資料を生成しました！')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                営業資料作成AI
              </h1>
              <p className="text-xs text-gray-400">顧客情報から最適な営業資料を自動生成</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 入力フォーム */}
          <div className="lg:col-span-1 space-y-6">
            {/* ドキュメントタイプ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50"
            >
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-400" />
                資料タイプ
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {documentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedType === type.id
                        ? 'bg-green-500/20 border-green-500'
                        : 'bg-gray-700/30 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <type.icon className={`w-5 h-5 mb-2 ${selectedType === type.id ? 'text-green-400' : 'text-gray-400'}`} />
                    <p className="font-medium text-sm">{type.name}</p>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* 顧客情報 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50"
            >
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-green-400" />
                顧客情報
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">企業名</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    placeholder="例：株式会社○○"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">業種</label>
                  <select
                    value={clientIndustry}
                    onChange={(e) => setClientIndustry(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">選択してください</option>
                    <option value="IT">IT・ソフトウェア</option>
                    <option value="製造">製造業</option>
                    <option value="小売">小売・EC</option>
                    <option value="金融">金融・保険</option>
                    <option value="サービス">サービス業</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">課題・ニーズ</label>
                  <textarea
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    placeholder="例：マーケティングコンテンツの作成に時間がかかっている..."
                  />
                </div>
              </div>
            </motion.div>

            {/* 生成ボタン */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 disabled:opacity-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  営業資料を生成
                </>
              )}
            </motion.button>
          </div>

          {/* プレビュー */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                プレビュー
              </h2>
              {slides && (
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 transition-colors">
                    <Copy className="w-4 h-4" />
                    コピー
                  </button>
                  <button className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm flex items-center gap-2 transition-colors">
                    <Download className="w-4 h-4" />
                    PPT出力
                  </button>
                </div>
              )}
            </div>

            {slides ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {slides.map((slide, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="aspect-[16/9] bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-4 border border-gray-600 cursor-pointer hover:border-green-500 transition-colors"
                  >
                    <div className="text-xs text-gray-400 mb-2">スライド {index + 1}</div>
                    <h3 className="font-bold text-sm mb-2">{slide.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-line">{slide.content}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>左のフォームを入力して「営業資料を生成」をクリック</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}


