'use client'

// ドヤ社内インタビュー ログイン後のトップ: インタビュー一覧
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, ClipboardList, Image as ImageIcon, Loader2, Mic, Plus } from 'lucide-react'
import { api, Card, Notice, StatusBadge } from '@/components/shanai/ui'

interface Row {
  id: string
  mode: 'voice' | 'survey'
  status: string
  intervieweeName: string
  department: string
  position: string
  latestTitle: string | null
  photoCount: number
  updatedAt: string
}

export default function ShanaiTool() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [companyReady, setCompanyReady] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [list, company] = await Promise.all([api<{ interviews: Row[] }>('/api/shanai/interviews'), api<{ company: any }>('/api/shanai/company')])
        setRows(list.interviews)
        setCompanyReady(!!company.company?.name && (company.company?.sources?.length || 0) > 0)
      } catch (e) {
        if ((e as any)?.status === 401) window.location.href = '/auth/signin?callbackUrl=/shanai'
        setError((e as Error).message)
        setRows([])
      }
    })()
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 lg:text-3xl">ドヤ社内インタビュー</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">録音かアンケートと写真から、会社の魅力が伝わる社員インタビュー記事を作ります。</p>
        </div>
        <Link href="/shanai/new" className="inline-flex items-center gap-1.5 rounded-xl bg-[#c026d3] px-4 py-2.5 text-sm font-black text-white hover:bg-[#a21caf]">
          <Plus className="h-4 w-4" />
          インタビューを作る
        </Link>
      </div>

      {companyReady === false && (
        <Card className="mt-6 border-fuchsia-200 bg-fuchsia-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-600" />
              <div>
                <p className="text-sm font-black text-slate-900">はじめに会社情報を登録してください</p>
                <p className="mt-0.5 text-xs font-bold leading-relaxed text-slate-600">
                  会社サイトやサービスサイトのURLを入れると、ミッション・事業・制度などを読み取り、記事の中で会社の魅力として紹介します。
                </p>
              </div>
            </div>
            <Link href="/shanai/company" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-fuchsia-700 ring-1 ring-fuchsia-200 hover:bg-fuchsia-50">
              会社情報を登録する
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-6">
        {rows === null ? (
          <div className="flex items-center gap-2 py-16 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込んでいます
          </div>
        ) : rows.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-base font-black text-slate-800">まだインタビューがありません</p>
            <p className="mt-1 text-sm font-bold text-slate-500">録音をアップロードするか、社員にアンケートを送って始めましょう。</p>
            <Link href="/shanai/new" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#c026d3] px-4 py-2.5 text-sm font-black text-white hover:bg-[#a21caf]">
              <Plus className="h-4 w-4" />
              インタビューを作る
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/shanai/interviews/${r.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-fuchsia-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{r.intervieweeName} さん</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{[r.department, r.position].filter(Boolean).join(' / ') || '部署未設定'}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-[#c026d3]" />
                </div>
                {r.latestTitle && <p className="mt-3 line-clamp-2 text-sm font-black leading-snug text-slate-700">{r.latestTitle}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-500">
                  <StatusBadge status={r.status} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    {r.mode === 'voice' ? <Mic className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                    {r.mode === 'voice' ? '録音' : 'アンケート'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    <ImageIcon className="h-3 w-3" />
                    写真 {r.photoCount}枚
                  </span>
                  <span className="ml-auto font-bold text-slate-400">{new Date(r.updatedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
