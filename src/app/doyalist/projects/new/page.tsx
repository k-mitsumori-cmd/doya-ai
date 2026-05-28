'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

const INDUSTRY_OPTIONS = ['IT', '製造', '小売', '医療', '教育', '金融', '不動産', 'その他']
const REGION_OPTIONS = ['全国', '東京', '大阪', '名古屋', '福岡', 'その他']
const TARGET_SIZE_OPTIONS = ['大企業', '中小企業', 'スタートアップ', '個人事業']

export default function NewProjectPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    industry: '',
    region: '',
    targetSize: '',
    keywords: '',
  })

  const update = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('プロジェクト名を入力してください')
      return
    }

    setSubmitting(true)
    const id = toast.loading('プロジェクトを作成中...')
    try {
      const res = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || '作成に失敗しました')
      }
      toast.success('プロジェクトを作成しました', { id })
      const newId = data?.project?.id || data?.id
      if (newId) {
        router.push(`/doyalist/projects/${newId}`)
      } else {
        router.push('/doyalist/projects')
      }
    } catch (e: any) {
      toast.error(e?.message || '作成に失敗しました', { id })
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/doyalist/projects"
          className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#7f19e6] transition-colors mb-3"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          プロジェクト一覧へ
        </Link>
        <h1 className="text-2xl lg:text-3xl font-black text-slate-800">新規プロジェクト</h1>
        <p className="text-sm text-slate-500 mt-1">
          ターゲット条件を入力すると、AIが最適な企業リストを生成できるようになります
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 space-y-6"
      >
        <Field
          label="プロジェクト名"
          required
          icon="badge"
          help="社内で識別しやすい名前を付けてください"
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="例：2026年春 IT企業アプローチ"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all"
            required
          />
        </Field>

        <Field label="説明" icon="description" help="プロジェクトの目的やメモ（任意）">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="例：新サービスの初期顧客となる中堅IT企業を中心にアプローチ"
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all resize-none"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="業界" icon="business">
            <SelectInput
              value={form.industry}
              onChange={(v) => update('industry', v)}
              options={INDUSTRY_OPTIONS}
              placeholder="業界を選択"
            />
          </Field>
          <Field label="地域" icon="public">
            <SelectInput
              value={form.region}
              onChange={(v) => update('region', v)}
              options={REGION_OPTIONS}
              placeholder="地域を選択"
            />
          </Field>
        </div>

        <Field label="ターゲット規模" icon="groups">
          <SelectInput
            value={form.targetSize}
            onChange={(v) => update('targetSize', v)}
            options={TARGET_SIZE_OPTIONS}
            placeholder="規模を選択"
          />
        </Field>

        <Field label="キーワード" icon="tag" help="カンマ区切りで複数指定できます">
          <textarea
            value={form.keywords}
            onChange={(e) => update('keywords', e.target.value)}
            placeholder="例：SaaS, B2B, AI, クラウド"
            rows={2}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all resize-none"
          />
        </Field>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <Link
            href="/doyalist/projects"
            className="px-6 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm text-center transition-colors"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-all"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">add_circle</span>
                プロジェクトを作成
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  icon,
  required,
  help,
  children,
}: {
  label: string
  icon?: string
  required?: boolean
  help?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-black text-slate-700 mb-1.5">
        {icon && <span className="material-symbols-outlined text-base text-[#7f19e6]">{icon}</span>}
        {label}
        {required && <span className="text-rose-500 text-xs">*必須</span>}
      </label>
      {help && <p className="text-xs text-slate-400 mb-2">{help}</p>}
      {children}
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all appearance-none cursor-pointer"
      style={{
        backgroundImage:
          'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 1rem center',
        backgroundSize: '16px',
        paddingRight: '2.5rem',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}
