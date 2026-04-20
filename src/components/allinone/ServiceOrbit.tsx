'use client'

import { motion } from 'framer-motion'
import { Image as ImageIcon, PenLine, LayoutGrid, Mic, Volume2, BarChart3, Film, Send, Sparkles, Target, FileText } from 'lucide-react'

const SERVICES = [
  { id: 'banner', name: 'ドヤバナーAI', icon: ImageIcon, color: 'from-purple-500 to-pink-500', href: '/banner' },
  { id: 'seo', name: 'ドヤ記事AI', icon: FileText, color: 'from-slate-700 to-slate-900', href: '/seo' },
  { id: 'persona', name: 'ドヤペルソナAI', icon: Target, color: 'from-purple-500 to-purple-700', href: '/persona' },
  { id: 'copy', name: 'ドヤコピーAI', icon: PenLine, color: 'from-amber-500 to-orange-500', href: '/copy' },
  { id: 'lp', name: 'ドヤLP AI', icon: LayoutGrid, color: 'from-cyan-500 to-blue-500', href: '/lp' },
  { id: 'movie', name: 'ドヤムービーAI', icon: Film, color: 'from-rose-500 to-pink-500', href: '/movie' },
  { id: 'voice', name: 'ドヤボイスAI', icon: Volume2, color: 'from-violet-500 to-purple-500', href: '/voice' },
  { id: 'adsim', name: 'ドヤ広告シミュAI', icon: BarChart3, color: 'from-indigo-500 to-blue-600', href: '/adsim' },
  { id: 'interviewx', name: 'ドヤヒヤリングAI', icon: Send, color: 'from-indigo-500 to-violet-500', href: '/interviewx' },
  { id: 'interview', name: 'ドヤインタビューAI', icon: Mic, color: 'from-orange-500 to-amber-500', href: '/interview' },
]

export function ServiceOrbit() {
  return (
    <section className="relative overflow-hidden bg-allinone-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-allinone-primary">
            <Sparkles className="h-3 w-3" />
            TOOL UNIVERSE
          </div>
          <h2 className="text-3xl font-black tracking-tight text-allinone-ink sm:text-5xl">
            ドヤAI 全ツールが、
            <br />
            <span className="bg-gradient-to-r from-allinone-primary to-allinone-cyan bg-clip-text text-transparent">
              分析結果からそのまま繋がる。
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-allinone-muted sm:text-base">
            分析結果をワンクリックで各ツールへ。記事作成、バナー量産、広告提案、ナレーション…全部が連携。
          </p>
        </motion.div>

        <div className="relative mx-auto h-[520px] w-full max-w-[520px]">
          {/* 中央ブランド */}
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-allinone-primary via-fuchsia-500 to-allinone-cyan text-white shadow-2xl shadow-allinone-primary/40">
                <div className="text-center">
                  <Sparkles className="mx-auto h-7 w-7" />
                  <div className="mt-1 text-xs font-black tracking-wide">ドヤマーケAI</div>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-0 -z-10 animate-allinone-ping-slow rounded-3xl bg-allinone-primary/40" />
            </motion.div>
          </div>

          {/* 2 本の軌道リング（逆回転） */}
          <div className="absolute inset-0 z-10 animate-allinone-orbit">
            {SERVICES.slice(0, 5).map((s, i) => {
              const Icon = s.icon
              const angle = (i / 5) * Math.PI * 2
              const r = 210
              const x = Math.cos(angle) * r
              const y = Math.sin(angle) * r
              return (
                <a
                  key={s.id}
                  href={s.href}
                  className="group absolute"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="animate-allinone-orbit-reverse">
                    <ServiceChip icon={Icon} name={s.name} color={s.color} />
                  </div>
                </a>
              )
            })}
          </div>
          <div className="absolute inset-0 z-10 animate-allinone-orbit-reverse">
            {SERVICES.slice(5).map((s, i) => {
              const Icon = s.icon
              const angle = (i / 5) * Math.PI * 2 + Math.PI / 5
              const r = 130
              const x = Math.cos(angle) * r
              const y = Math.sin(angle) * r
              return (
                <a
                  key={s.id}
                  href={s.href}
                  className="group absolute"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="animate-allinone-orbit">
                    <ServiceChip icon={Icon} name={s.name} color={s.color} small />
                  </div>
                </a>
              )
            })}
          </div>

          {/* 軌道のリング線 */}
          <svg className="absolute inset-0 -z-0 h-full w-full" viewBox="-260 -260 520 520">
            <circle r="210" fill="none" stroke="#E6E8F0" strokeDasharray="2 6" />
            <circle r="130" fill="none" stroke="#E6E8F0" strokeDasharray="2 6" />
          </svg>
        </div>
      </div>
    </section>
  )
}

function ServiceChip({
  icon: Icon,
  name,
  color,
  small,
}: {
  icon: React.ElementType
  name: string
  color: string
  small?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`grid ${small ? 'h-12 w-12' : 'h-14 w-14'} place-items-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg transition group-hover:scale-110 group-hover:rotate-6`}
      >
        <Icon className={small ? 'h-5 w-5' : 'h-6 w-6'} />
      </div>
      <span className="whitespace-nowrap rounded-full border border-allinone-line bg-white px-2 py-0.5 text-[10px] font-black text-allinone-ink opacity-0 transition group-hover:opacity-100">
        {name}
      </span>
    </div>
  )
}
