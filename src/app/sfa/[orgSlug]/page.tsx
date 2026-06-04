'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function SfaDashboard() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const base = `/sfa/${orgSlug}`
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    fetch('/api/sfa/usage', { cache: 'no-store' }).then((r) => r.json()).then(setUsage).catch(() => {})
  }, [])

  const c = usage?.counts || {}
  const stats = [
    { label: '取引先', value: c.accounts ?? '—', href: `${base}/accounts`, icon: 'business', color: 'from-green-500 to-emerald-600' },
    { label: '商談', value: c.deals ?? '—', href: `${base}/deals`, icon: 'view_kanban', color: 'from-emerald-500 to-lime-600' },
  ]

  return (
    <div className="min-h-full bg-gradient-to-b from-[#F0FDF4] to-slate-50">
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center text-2xl shadow-lg shadow-green-500/30">
            📈
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">ダッシュボード</h1>
            <p className="text-slate-500 font-bold text-sm">今日の営業状況をひと目で。入力はAIにおまかせ！</p>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                <span className="material-symbols-outlined text-white text-lg">{s.icon}</span>
              </div>
              <p className="text-3xl font-black text-slate-900 leading-none">{s.value}</p>
              <p className="text-xs font-bold text-slate-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* クイックアクション */}
        <div className="mt-8">
          <h2 className="font-black text-slate-700 mb-3">クイックアクション</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`${base}/deals`} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-5">
              <span className="material-symbols-outlined text-3xl text-green-600">view_kanban</span>
              <div>
                <p className="font-black text-slate-800">商談パイプライン</p>
                <p className="text-xs font-bold text-slate-500">カンバンで案件を管理（主役）</p>
              </div>
            </Link>
            <Link href={`${base}/accounts`} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-5">
              <span className="material-symbols-outlined text-3xl text-emerald-600">business</span>
              <div>
                <p className="font-black text-slate-800">取引先を登録</p>
                <p className="text-xs font-bold text-slate-500">会社・担当者を一元管理</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-green-50 border border-green-100 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <p className="text-sm font-bold text-slate-600 leading-relaxed">
            サンプルの取引先・商談を用意しています。自由に編集・削除して、自社の営業管理を始めましょう。
            商談はカンバンでステージ管理でき、取引先・商談はいつでもCSVで書き出せます。
          </p>
        </div>
      </div>
    </div>
  )
}
