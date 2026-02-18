'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Download, Terminal, FileText, Package, ArrowLeft, PartyPopper } from 'lucide-react'

interface CodeExporterProps {
  files: {
    'OpeningAnimation.tsx': string
    'README.md': string
    'package.json': string
  }
  onBack: () => void
  isPro: boolean
}

export default function CodeExporter({ files, onBack, isPro }: CodeExporterProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof files>('OpeningAnimation.tsx')
  const [copied, setCopied] = useState(false)
  const [showCelebration, setShowCelebration] = useState(true)

  const tabs = [
    { key: 'OpeningAnimation.tsx' as const, icon: Terminal, label: 'OpeningAnimation.tsx' },
    { key: 'README.md' as const, icon: FileText, label: 'README.md' },
    { key: 'package.json' as const, icon: Package, label: 'package.json' },
  ]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(files[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
      {/* Celebration overlay */}
      {showCelebration && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowCelebration(false)}
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <PartyPopper className="h-16 w-16 text-[#FFD700] mx-auto mb-4" />
            <h2 className="text-4xl font-black text-white mb-2">完成!</h2>
            <p className="text-white/60">コードをコピーしてプロジェクトに貼り付けてください</p>
            <button
              onClick={() => setShowCelebration(false)}
              className="mt-6 px-8 py-3 bg-[#EF4343] rounded-xl font-bold text-white"
            >
              コードを確認する
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Code Editor */}
      <div className="flex-1 flex flex-col rounded-xl border border-[#2d1616] bg-[#0a0a0a] overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center border-b border-[#2d1616] bg-[#0f0808]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-[#EF4343] text-white bg-[#1a0d0d]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={handleCopy}
            className="mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>

        {/* Code content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-sm font-mono leading-relaxed text-white/80 whitespace-pre-wrap">
            {files[activeTab]}
          </pre>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#2d1616] bg-[#0f0808] text-[10px] text-white/30">
          <span>TypeScript React</span>
          <span>{files[activeTab].split('\n').length} lines</span>
        </div>
      </div>

      {/* Info Panel */}
      <div className="w-full lg:w-[380px] space-y-6">
        {/* Usage steps */}
        <div className="rounded-xl border border-[#2d1616] bg-[#1a0d0d] p-6">
          <h3 className="text-lg font-bold text-white mb-4">使い方</h3>
          <div className="space-y-4">
            {[
              { step: 1, text: 'framer-motion をインストール', code: 'npm install framer-motion' },
              { step: 2, text: 'コンポーネントをコピーして配置', code: 'components/OpeningAnimation.tsx' },
              { step: 3, text: 'アプリで使用', code: '<OpeningAnimation onComplete={() => ...} />' },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#EF4343]/20 text-[#EF4343] text-xs font-bold">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm text-white">{item.text}</p>
                  <code className="text-xs text-[#EF4343]/60 font-mono">{item.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download button */}
        <button
          disabled={!isPro}
          className="w-full py-4 bg-[#EF4343] hover:bg-[#EF4343]/90 text-white rounded-xl font-bold shadow-2xl shadow-[#EF4343]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="h-5 w-5" />
          {isPro ? 'ZIP ダウンロード' : 'ZIP ダウンロード（PRO）'}
        </button>

        {/* Back button */}
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          別のテンプレートを試す
        </button>
      </div>
    </div>
  )
}
