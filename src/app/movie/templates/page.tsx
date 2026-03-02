'use client'
// ============================================
// ドヤムービーAI - テンプレート一覧
// ============================================
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { MovieTemplate, TemplateCategory } from '@/lib/movie/types'

const CATEGORY_LABELS: Record<TemplateCategory | 'all', string> = {
  all: 'すべて',
  it_saas: 'IT・SaaS',
  ec_retail: 'EC・小売',
  food: 'フード',
  real_estate: '不動産',
  beauty: '美容',
  education: '教育',
  finance: '金融',
  medical: '医療',
  recruit: '採用',
  btob: 'BtoB',
  general: '汎用',
}

const DURATION_LABELS: Record<number, string> = {
  6: '6秒',
  15: '15秒',
  30: '30秒',
  60: '60秒',
}

function TemplateCard({ template }: { template: MovieTemplate }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-rose-900/30 bg-slate-900/60 overflow-hidden hover:border-rose-700/50 transition-all group"
    >
      {/* サムネイル */}
      <div
        className="aspect-video flex items-center justify-center relative"
        style={{
          background: 'linear-gradient(135deg, #1c0a10, #1e0b1a)',
        }}
      >
        {template.thumbnail ? (
          <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl opacity-30">🎬</span>
        )}
        {template.isPro && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full">
            PRO
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          {DURATION_LABELS[template.duration] || `${template.duration}秒`} · {template.aspectRatio}
        </div>
      </div>

      {/* 情報 */}
      <div className="p-4">
        <h3 className="text-white font-bold text-sm mb-1 group-hover:text-rose-200 transition-colors">{template.name}</h3>
        <p className="text-rose-200/50 text-xs mb-3 line-clamp-2">{template.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-rose-900/30 text-rose-300/70 text-xs">
              {tag}
            </span>
          ))}
        </div>
        <Link
          href={template.isPro ? '/movie/pricing' : `/movie/new/concept?templateId=${template.id}`}
          className={`block w-full text-center py-2 rounded-xl text-sm font-bold transition-all ${
            template.isPro
              ? 'border border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
              : 'text-white'
          }`}
          style={template.isPro ? {} : { background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          {template.isPro ? 'Proで使う' : 'このテンプレートを使う'}
        </Link>
      </div>
    </motion.div>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MovieTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')

  useEffect(() => {
    const url = category === 'all'
      ? '/api/movie/templates'
      : `/api/movie/templates?category=${category}`
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (d.templates) setTemplates(d.templates) })
      .catch(() => {/* テンプレート取得失敗 - 空リスト表示 */})
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-2">テンプレート</h1>
        <p className="text-rose-200/60 text-sm">業種・目的別のテンプレートから選んで、すばやく動画を作成できます。</p>
      </div>

      {/* カテゴリフィルタ */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setCategory(id); setLoading(true) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              category === id
                ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                : 'border-rose-900/30 text-slate-400 hover:border-rose-700/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* グリッド */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl border border-rose-900/30 bg-slate-900/60 animate-pulse aspect-[4/5]" />
          ))}
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map(t => <TemplateCard key={t.id} template={t} />)}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-rose-200/50">このカテゴリのテンプレートはありません</p>
        </div>
      )}
    </div>
  )
}
