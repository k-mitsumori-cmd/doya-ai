'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  MessageSquare, 
  Upload, 
  FileText, 
  Mic, 
  Play, 
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Users,
  Building,
  Target,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const sampleOutput = `## 導入事例：株式会社ABC様

### 会社概要
- 業種：IT・ソフトウェア開発
- 従業員数：150名
- 導入時期：2024年4月

### 導入前の課題
マーケティング部門では、毎月のLP作成やSNS投稿に多大な時間を費やしていました。
特にキャッチコピーの作成には、1つあたり2〜3時間かかることも...

### DOYA-AI導入の決め手
「テンプレートを選ぶだけで高品質な文章が作れる点が魅力でした」（マーケティング部・田中様）

### 導入後の効果
- LP作成時間：8時間 → 2時間（75%削減）
- SNS投稿作成：1時間 → 10分（83%削減）
- 月間コンテンツ数：2倍に増加

### お客様の声
「DOYA-AIのおかげで、クリエイティブな作業に集中できるようになりました。
もう手放せないツールです！」
`

export default function CaseInterviewPage() {
  const [step, setStep] = useState(1)
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [interviewee, setInterviewee] = useState('')
  const [transcript, setTranscript] = useState('')
  const [output, setOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    // シミュレート
    await new Promise(resolve => setTimeout(resolve, 2500))
    setOutput(sampleOutput.replace('株式会社ABC', companyName || '株式会社ABC'))
    setIsGenerating(false)
    setStep(3)
    toast.success('事例テキストを生成しました！')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    toast.success('クリップボードにコピーしました')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                事例インタビュー生成
              </h1>
              <p className="text-xs text-gray-400">インタビュー内容から導入事例を自動生成</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[
            { num: 1, label: '基本情報入力' },
            { num: 2, label: 'インタビュー内容' },
            { num: 3, label: '事例テキスト生成' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s.num ? 'bg-blue-500' : 'bg-gray-700'
              }`}>
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className={`text-sm hidden sm:block ${step >= s.num ? 'text-white' : 'text-gray-500'}`}>
                {s.label}
              </span>
              {i < 2 && <div className={`w-12 h-0.5 ${step > s.num ? 'bg-blue-500' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: 基本情報 */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-400" />
              導入企業の基本情報
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">企業名 *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="例：株式会社ABC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">業種 *</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  <option value="IT">IT・ソフトウェア</option>
                  <option value="製造">製造業</option>
                  <option value="小売">小売・EC</option>
                  <option value="金融">金融・保険</option>
                  <option value="サービス">サービス業</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">インタビュー対象者</label>
                <input
                  type="text"
                  value={interviewee}
                  onChange={(e) => setInterviewee(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="例：マーケティング部 部長 田中様"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!companyName || !industry}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-bold transition-colors"
              >
                次へ進む
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: インタビュー内容 */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Mic className="w-5 h-5 text-blue-400" />
              インタビュー内容を入力
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              文字起こしテキストを貼り付けるか、音声ファイルをアップロードしてください。
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700/30 rounded-xl p-6 border border-dashed border-gray-600 text-center cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-400">音声ファイルをアップロード</p>
                <p className="text-xs text-gray-500 mt-1">.mp3, .wav, .m4a</p>
              </div>
              <div className="bg-gray-700/30 rounded-xl p-6 border border-dashed border-gray-600 text-center cursor-pointer hover:border-blue-500 transition-colors">
                <FileText className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-400">文字起こしファイルをアップロード</p>
                <p className="text-xs text-gray-500 mt-1">.txt, .docx</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                または、テキストを直接入力
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="インタビューの文字起こしテキストを貼り付けてください...

例：
Q: DOYA-AIを導入したきっかけを教えてください。
A: 以前は毎月のLP作成に多くの時間を費やしていました..."
              />
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleGenerate}
                disabled={!transcript || isGenerating}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 disabled:opacity-50 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    事例を生成する
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: 生成結果 */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  事例テキストが完成しました
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    コピー
                  </button>
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 transition-colors">
                    <Download className="w-4 h-4" />
                    ダウンロード
                  </button>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-6 whitespace-pre-wrap text-gray-300 text-sm leading-relaxed max-h-[500px] overflow-y-auto">
                {output}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                内容を修正
              </button>
              <button
                onClick={() => {
                  setStep(1)
                  setCompanyName('')
                  setIndustry('')
                  setInterviewee('')
                  setTranscript('')
                  setOutput('')
                }}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium transition-colors"
              >
                新しい事例を作成
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}


