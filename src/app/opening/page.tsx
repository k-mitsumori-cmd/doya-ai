'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Zap, Code2, Palette, MousePointer } from 'lucide-react'
import UrlInputForm from '@/components/opening/UrlInputForm'

export default function OpeningLandingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (url: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/opening/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.success && data.projectId) {
        router.push(`/opening/projects/${data.projectId}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-[#EF4343]/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[#FFD700]/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[20%] h-[400px] w-[400px] rounded-full bg-[#DC2626]/5 blur-[100px]" />
      </div>

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-[#EF4343]/20 bg-[#EF4343]/5 text-sm text-[#EF4343]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Zap className="h-4 w-4" />
            URLを入れるだけ。AIが自動生成。
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            <span className="text-white">感動の</span>
            <br />
            <span className="bg-gradient-to-r from-[#EF4343] to-[#FFD700] bg-clip-text text-transparent">
              オープニング
            </span>
            <span className="text-white">を。</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-xl mx-auto leading-relaxed">
            あなたのサイトに最適化された<br className="md:hidden" />
            Reactアニメーションを、<br className="md:hidden" />
            AIが6種類提案します
          </p>
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <UrlInputForm onSubmit={handleSubmit} isLoading={isLoading} />
        </motion.div>

        <motion.p
          className="mt-6 text-sm text-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          無料で3回まで試せます・クレカ不要
        </motion.p>
      </section>

      {/* How it works */}
      <section className="relative py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-black text-center text-white mb-16">
            3ステップで<span className="text-[#EF4343]">完成</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: MousePointer,
                step: '01',
                title: 'URLを入力',
                desc: 'サイトのURLを入れるだけ。カラー・ロゴ・テキストをAIが自動抽出',
              },
              {
                icon: Palette,
                step: '02',
                title: '6種類から選ぶ',
                desc: 'あなたのサイトに最適化された6種類のアニメーションをプレビュー',
              },
              {
                icon: Code2,
                step: '03',
                title: 'コードをコピー',
                desc: 'Reactコンポーネントをコピーしてプロジェクトに貼り付けるだけ',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="relative p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EF4343]/10 mb-4">
                  <item.icon className="h-6 w-6 text-[#EF4343]" />
                </div>
                <p className="text-xs font-bold text-[#EF4343]/60 uppercase tracking-widest mb-2">Step {item.step}</p>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
