'use client'

// ドヤ社内インタビュー ログイン後のトップ: インタビュー一覧
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, ClipboardList, Image as ImageIcon, Mic, Plus } from 'lucide-react'
import { api, Card, EmptyState, ErrorState, PageSkeleton, StatusBadge } from '@/components/shanai/ui'
import { useInShanaiShell } from '@/components/shanai/shell-context'
import { useUiNext } from '@/components/shell/ui-next-context'
import { ShanaiHero, ShanaiStats, ShanaiSteps, ShanaiCardList } from '@/components/shanai/next'

export interface ShanaiRow {
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

/** initialRows を渡すと読み込みをしない（開発用の見本画面 /shanai/dev/states で使う） */
export default function ShanaiTool({ initialRows, initialCompanyReady }: { initialRows?: ShanaiRow[]; initialCompanyReady?: boolean } = {}) {
  const [rows, setRows] = useState<ShanaiRow[] | null>(initialRows ?? null)
  const [companyReady, setCompanyReady] = useState<boolean | null>(initialCompanyReady ?? null)
  const [error, setError] = useState<string | null>(null)
  // 共通シェルの中では ToolFrame が見出しと説明を出すので、ここでは出さない
  const inShell = useInShanaiShell()
  // 新しい見た目（キービジュアル・数字・使い方・カードの入り）は、許可した人だけに出す（チェックリスト §5.1）
  const uiNext = useUiNext()

  const load = async () => {
    setError(null)
    setRows(null)
    try {
      const [list, company] = await Promise.all([api<{ interviews: ShanaiRow[] }>('/api/shanai/interviews'), api<{ company: any }>('/api/shanai/company')])
      setRows(list.interviews)
      setCompanyReady(!!company.company?.name && (company.company?.sources?.length || 0) > 0)
    } catch (e) {
      if ((e as any)?.status === 401) window.location.href = '/auth/signin?callbackUrl=/shanai'
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (initialRows) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (rows === null) return <PageSkeleton variant="list" />

  if (uiNext) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <ShanaiHero />
        {companyReady === false && <CompanyNotice />}
        {rows.length === 0 ? <ShanaiSteps /> : (
          <>
            <ShanaiStats rows={rows} />
            <ShanaiCardList rows={rows} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {!inShell && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui-renewal/mascots/shanai.webp" alt="" aria-hidden className="hidden h-20 w-auto sm:block" />
          <div>
          <h1 className="text-[22px] font-bold leading-[1.3] text-[var(--ink)] sm:text-[28px]">ドヤ社内インタビュー</h1>
          <p className="mt-1 text-[13px] font-medium leading-[1.5] text-[var(--sub)]">録音かアンケートと写真から、会社の魅力が伝わる社員インタビュー記事を作ります。</p>
          </div>
        </div>
        )}
        <Link href="/shanai/new" className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--blue)] px-4 py-2.5 text-sm font-black text-white hover:bg-[var(--blue-deep)]">
          <Plus className="h-4 w-4" />
          インタビューを作る
        </Link>
      </div>

      {companyReady === false && <CompanyNotice className="mt-6" />}

      <div className="mt-6">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              image="/shanai/empty-interviews.webp"
              title="まだインタビューがありません"
              desc="録音をアップロードするか、社員にアンケートを送ると、ここに並びます。"
              action={
                <Link href="/shanai/new" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--blue)] px-4 text-sm font-black text-white hover:bg-[var(--blue-deep)]">
                  <Plus className="h-4 w-4" />
                  インタビューを作る
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/shanai/interviews/${r.id}`}
                className="group block rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-0.5 hover:border-[var(--blue-line)] hover:shadow-[var(--shadow-lg)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[var(--ink)]">{r.intervieweeName} さん</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-[var(--sub)]">{[r.department, r.position].filter(Boolean).join(' / ') || '部署未設定'}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--blue)]" />
                </div>
                {r.latestTitle && <p className="mt-3 line-clamp-2 text-sm font-black leading-snug text-[var(--sub)]">{r.latestTitle}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black text-[var(--sub)]">
                  <StatusBadge status={r.status} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2 py-0.5">
                    {r.mode === 'voice' ? <Mic className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                    {r.mode === 'voice' ? '録音' : 'アンケート'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2 py-0.5">
                    <ImageIcon className="h-3 w-3" />
                    写真 {r.photoCount}枚
                  </span>
                  <span className="ml-auto font-bold text-[var(--muted)]">{new Date(r.updatedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 会社情報が未登録のときの案内 */
function CompanyNotice({ className = '' }: { className?: string }) {
  return (
    <Card className={`${className} border-[var(--blue-line)] bg-[var(--blue-soft)]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--blue-deep)]" />
          <div>
            <p className="text-sm font-black text-[var(--ink)]">はじめに会社情報を登録してください</p>
            <p className="mt-0.5 text-xs font-bold leading-relaxed text-[var(--sub)]">
              会社サイトやサービスサイトのURLを入れると、ミッション・事業・制度などを読み取ります。読み取った内容は、記事の中で会社の魅力として紹介します。
            </p>
          </div>
        </div>
        <Link href="/shanai/company" className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--paper)] px-3 py-2 text-xs font-black text-[var(--blue-deep)] ring-1 ring-[var(--blue-line)] hover:bg-[var(--blue-soft)]">
          会社情報を登録する
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}
