'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Activity, 
  Upload, 
  FileText, 
  Mic, 
  Play, 
  Pause,
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Clock,
  Volume2,
  FileAudio,
  Edit3
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const sampleTranscript = `[00:00:15] インタビュアー：
本日はお時間いただきありがとうございます。早速ですが、DOYA-AIを導入されたきっかけについて教えていただけますか？

[00:00:32] 田中様：
はい、ありがとうございます。以前から社内でChatGPTを使っていたんですが、なかなか使いこなせる人が限られていまして。特にマーケティング部門では、プロンプトを書くのが難しいという声が多かったんです。

[00:01:05] インタビュアー：
なるほど。プロンプト作成の難しさが課題だったんですね。

[00:01:12] 田中様：
そうなんです。そんな時にDOYA-AIを知りまして、テンプレートを選ぶだけで使えるというのが魅力的で導入を決めました。

[00:01:35] インタビュアー：
導入後、どのような変化がありましたか？

[00:01:42] 田中様：
劇的に変わりましたね。今までLP作成に8時間かかっていたのが、2時間で終わるようになりました。時間にして75%の削減です。

[00:02:10] インタビュアー：
素晴らしい効果ですね。他に何かエピソードはありますか？

[00:02:18] 田中様：
SNS投稿も楽になりました。以前は投稿文を考えるのに1時間かかっていたのが、今は10分です。おかげで月のコンテンツ数が2倍になりました。`

const sampleCaseText = `## 導入事例：株式会社サンプル様

### 会社概要
- 業種：IT・ソフトウェア開発
- 従業員数：150名
- 導入時期：2024年4月

### 導入前の課題
マーケティング部門では、ChatGPTを使いこなせる人が限られていた。
特にプロンプト作成の難しさが大きな課題となっていた。

### DOYA-AI導入の決め手
「テンプレートを選ぶだけで使えるというのが魅力的でした」（マーケティング部・田中様）

### 導入後の効果
- LP作成時間：8時間 → 2時間（75%削減）
- SNS投稿作成：1時間 → 10分
- 月間コンテンツ数：2倍に増加

### お客様の声
「劇的に変わりました。時間にして75%の削減です。」`

export default function TranscriptionPage() {
  const [step, setStep] = useState<'upload' | 'transcript' | 'case'>('upload')
  const [fileName, setFileName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [caseText, setCaseText] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  const handleFileUpload = async () => {
    setFileName('interview_20241215.mp3')
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 3000))
    setTranscript(sampleTranscript)
    setIsProcessing(false)
    setStep('transcript')
    toast.success('文字起こしが完了しました！')
  }

  const handleGenerateCase = async () => {
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setCaseText(sampleCaseText)
    setIsProcessing(false)
    setStep('case')
    toast.success('事例テキストを生成しました！')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
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
                <Activity className="w-5 h-5 text-purple-400" />
                文字起こし → 事例テキスト
              </h1>
              <p className="text-xs text-gray-400">商談録音から導入事例を自動生成</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[
            { id: 'upload', label: '音声アップロード' },
            { id: 'transcript', label: '文字起こし確認' },
            { id: 'case', label: '事例テキスト' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step === s.id ? 'bg-purple-500' : 
                (step === 'transcript' && s.id === 'upload') || (step === 'case') ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {(step === 'transcript' && s.id === 'upload') || 
                 (step === 'case' && s.id !== 'case') ? 
                  <CheckCircle className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${
                step === s.id ? 'text-white' : 'text-gray-500'
              }`}>
                {s.label}
              </span>
              {i < 2 && <div className={`w-12 h-0.5 ${
                (step === 'transcript' && i === 0) || (step === 'case') ? 'bg-green-500' : 'bg-gray-700'
              }`} />}
            </div>
          ))}
        </div>

        {/* アップロード画面 */}
        {step === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              音声ファイルをアップロード
            </h2>

            {isProcessing ? (
              <div className="py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
                  <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
                </div>
                <h3 className="text-lg font-bold mb-2">文字起こし中...</h3>
                <p className="text-gray-400">{fileName} を処理しています</p>
                <div className="mt-6 max-w-xs mx-auto">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3 }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={handleFileUpload}
                className="border-2 border-dashed border-gray-600 rounded-2xl p-16 text-center cursor-pointer hover:border-purple-500 transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
                  <FileAudio className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">クリックしてファイルを選択</h3>
                <p className="text-gray-400 mb-4">または、ファイルをドラッグ＆ドロップ</p>
                <p className="text-sm text-gray-500">対応形式: MP3, WAV, M4A, MP4（最大500MB）</p>
              </div>
            )}
          </motion.div>
        )}

        {/* 文字起こし確認画面 */}
        {step === 'transcript' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* 音声プレーヤー */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </button>
                <div className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-1/3" />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>01:15</span>
                    <span>03:45</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-sm">{fileName}</span>
                </div>
              </div>
            </div>

            {/* 文字起こしテキスト */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  文字起こし結果
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleCopy(transcript)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    コピー
                  </button>
                  <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    編集
                  </button>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
                {transcript}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                別のファイルを選択
              </button>
              <button
                onClick={handleGenerateCase}
                disabled={isProcessing}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    事例テキストを生成
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* 事例テキスト画面 */}
        {step === 'case' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  事例テキストが完成しました
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleCopy(caseText)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    コピー
                  </button>
                  <button className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    ダウンロード
                  </button>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-6 whitespace-pre-wrap text-gray-300 text-sm leading-relaxed max-h-[500px] overflow-y-auto">
                {caseText}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('transcript')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                文字起こしを確認
              </button>
              <button
                onClick={() => {
                  setStep('upload')
                  setFileName('')
                  setTranscript('')
                  setCaseText('')
                }}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-medium transition-colors"
              >
                新しいファイルを処理
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}


