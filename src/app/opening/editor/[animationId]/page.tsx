'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RotateCcw, Download, ArrowLeft, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { getTemplateComponent } from '@/components/opening/templates'

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const animationId = params.animationId as string
  const [animation, setAnimation] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openSection, setOpenSection] = useState<string>('text')
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  useEffect(() => {
    fetch(`/api/opening/animations/${animationId}`)
      .then(r => r.json())
      .then(data => {
        if (data.animation) {
          setAnimation(data.animation)
          setConfig(data.animation.config)
        }
      })
      .finally(() => setLoading(false))
  }, [animationId])

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = JSON.parse(JSON.stringify(prev))
      const parts = path.split('.')
      let obj = newConfig
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
      obj[parts[parts.length - 1]] = value
      return newConfig
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/opening/animations/${animationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    handleSave().then(() => router.push(`/opening/export/${animationId}`))
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-[#EF4343] border-t-transparent rounded-full" />
      </div>
    )
  }

  const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) => (
    <div className="border-b border-[#2d1616]">
      <button
        onClick={() => setOpenSection(openSection === id ? '' : id)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#EF4343]" />
          <span className="font-bold text-sm">{title}</span>
        </div>
        {openSection === id ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
      </button>
      {openSection === id && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
      {/* Preview (70%) - render actual template */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: config.colors?.background || '#0A0505' }}>
        <div className="absolute top-4 left-4 z-20">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </button>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <button onClick={() => setPreviewKey(k => k + 1)} className="p-2 rounded-lg bg-black/30 backdrop-blur-sm hover:bg-white/20 transition-colors">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {(() => {
          const TemplateComponent = animation?.templateId ? getTemplateComponent(animation.templateId) : null
          if (TemplateComponent) {
            return (
              <TemplateComponent
                key={previewKey}
                colors={config.colors || { primary: '#EF4343', secondary: '#DC2626', accent: '#FFD700', background: '#0A0505', text: '#FFFFFF' }}
                texts={config.texts || { headline: 'Headline', subtext: 'Subtext', cta: 'Get Started' }}
                logo={config.logo || { url: null, base64: null, alt: null }}
                timing={config.timing || { duration: 3.5, stagger: 0.2, easing: 'easeInOut' }}
                showLogo={config.showLogo ?? false}
                showCTA={config.showCTA ?? true}
                isPlaying={true}
                onComplete={() => {}}
                containerMode="contained"
              />
            )
          }
          return (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.h1
                className="text-5xl font-black"
                style={{ color: config.colors?.primary || '#EF4343' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {config.texts?.headline || 'Headline'}
              </motion.h1>
            </div>
          )
        })()}
      </div>

      {/* Settings Panel (30%) */}
      <div className="w-full lg:w-[380px] border-l border-[#2d1616] bg-[#0f0808] overflow-y-auto">
        <div className="border-b border-[#2d1616] px-5 py-4">
          <h2 className="font-bold">微調整エディタ</h2>
          <p className="text-xs text-white/30 mt-1">{(animation?.metadata as any)?.name || animation?.templateId}</p>
        </div>

        <Section id="text" title="テキスト編集" icon={Sparkles}>
          <div>
            <label className="text-xs text-white/50 mb-1 block">キャッチコピー</label>
            <input
              value={config.texts?.headline || ''}
              onChange={(e) => updateConfig('texts.headline', e.target.value)}
              className="w-full bg-[#0A0505] border border-[#2d1616] rounded-lg px-3 py-2 text-sm text-white focus:border-[#EF4343] focus:ring-1 focus:ring-[#EF4343] outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">サブテキスト</label>
            <input
              value={config.texts?.subtext || ''}
              onChange={(e) => updateConfig('texts.subtext', e.target.value)}
              className="w-full bg-[#0A0505] border border-[#2d1616] rounded-lg px-3 py-2 text-sm text-white focus:border-[#EF4343] focus:ring-1 focus:ring-[#EF4343] outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">CTAボタン</label>
            <div className="flex items-center gap-2">
              <input
                value={config.texts?.cta || ''}
                onChange={(e) => updateConfig('texts.cta', e.target.value)}
                className="flex-1 bg-[#0A0505] border border-[#2d1616] rounded-lg px-3 py-2 text-sm text-white focus:border-[#EF4343] focus:ring-1 focus:ring-[#EF4343] outline-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={config.showCTA}
                  onChange={(e) => updateConfig('showCTA', e.target.checked)}
                  className="accent-[#EF4343]"
                />
                表示
              </label>
            </div>
          </div>
        </Section>

        <Section id="colors" title="カラー調整" icon={Sparkles}>
          {['primary', 'secondary', 'accent', 'background'].map((key) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={config.colors?.[key] || '#000000'}
                onChange={(e) => updateConfig(`colors.${key}`, e.target.value)}
                className="h-8 w-8 rounded-lg border border-[#2d1616] cursor-pointer bg-transparent"
              />
              <div className="flex-1">
                <label className="text-xs text-white/50 capitalize">{key}</label>
                <input
                  value={config.colors?.[key] || ''}
                  onChange={(e) => updateConfig(`colors.${key}`, e.target.value)}
                  className="w-full bg-transparent text-xs text-white/70 font-mono outline-none"
                />
              </div>
            </div>
          ))}
        </Section>

        <Section id="timing" title="タイミング" icon={Sparkles}>
          <div>
            <label className="text-xs text-white/50 mb-1 block">速度: {config.timing?.duration || 3.5}s</label>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={config.timing?.duration || 3.5}
              onChange={(e) => updateConfig('timing.duration', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#0A0505] accent-[#EF4343] rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">遅延: {config.timing?.stagger || 0.2}s</label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={config.timing?.stagger || 0.2}
              onChange={(e) => updateConfig('timing.stagger', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#0A0505] accent-[#EF4343] rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">イージング</label>
            <select
              value={config.timing?.easing || 'easeInOut'}
              onChange={(e) => updateConfig('timing.easing', e.target.value)}
              className="w-full bg-[#0A0505] border border-[#2d1616] rounded-lg px-3 py-2 text-sm text-white focus:border-[#EF4343] outline-none"
            >
              <option value="easeInOut">Ease In-Out</option>
              <option value="easeOut">Ease Out</option>
              <option value="spring">Spring</option>
              <option value="linear">Linear</option>
            </select>
          </div>
        </Section>

        {/* Footer actions */}
        <div className="sticky bottom-0 border-t border-[#2d1616] bg-[#0f0808] p-5 space-y-3">
          <motion.button
            onClick={handleExport}
            className="w-full py-3.5 bg-[#EF4343] rounded-xl font-bold text-white shadow-lg shadow-[#EF4343]/20 hover:shadow-[#EF4343]/40 transition-shadow flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Download className="h-4 w-4" />
            エクスポート
          </motion.button>
          <button
            onClick={() => router.back()}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            別のテンプレートに戻る
          </button>
        </div>
      </div>
    </div>
  )
}
