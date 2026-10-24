'use client'

// ドヤ社内インタビュー ログイン後のトップ: インタビュー一覧
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2 } from 'lucide-react'
import { api, Card, ErrorState, PageSkeleton } from '@/components/shanai/ui'
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
  // 失敗の中身（status 付き）。新しい見た目では生の文を出さず、ここから「何が起きたか・どうすればよいか」を組み立てる
  const [error, setError] = useState<unknown>(null)
  // 新しい見た目（キービジュアル・数字・使い方・カードの入り）は、許可した人だけに出す（チェックリスト §5.1）

  const load = async () => {
    setError(null)
    setRows(null)
    try {
      const [list, company] = await Promise.all([api<{ interviews: ShanaiRow[] }>('/api/shanai/interviews'), api<{ company: any }>('/api/shanai/company')])
      setRows(list.interviews)
      setCompanyReady(!!company.company?.name && (company.company?.sources?.length || 0) > 0)
    } catch (e) {
      if ((e as any)?.status === 401) window.location.href = '/auth/signin?callbackUrl=/shanai'
      setError(e)
    }
  }

  useEffect(() => {
    if (initialRows) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <ErrorState message={(error as Error).message} error={error} onRetry={() => void load()} />
  if (rows === null) return <PageSkeleton variant="list" />

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <ShanaiHero />
      {companyReady === false && <CompanyNotice next />}
      {rows.length === 0 ? <ShanaiSteps /> : (
        <>
          <ShanaiStats rows={rows} />
          <ShanaiCardList rows={rows} />
        </>
      )}
    </div>
  )
}

/** 会社情報が未登録のときの案内 */
function CompanyNotice({ className = '', next = false }: { className?: string; next?: boolean }) {
  return (
    <Card className={`${className} border-[var(--blue-line)] bg-[var(--blue-soft)]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={next ? 'flex min-w-0 flex-1 basis-64 items-start gap-3' : 'flex items-start gap-3'}>
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--blue-deep)]" aria-hidden="true" />
          <div className={next ? 'min-w-0' : undefined}>
            <p className="text-sm font-black text-[var(--ink)]">はじめに会社情報を登録してください</p>
            <p className="mt-0.5 text-xs font-bold leading-relaxed text-[var(--sub)]">
              会社サイトやサービスサイトのURLを入れると、ミッション・事業・制度などを読み取ります。読み取った内容は、記事の中で会社の魅力として紹介します。
            </p>
          </div>
        </div>
        <Link
          href="/shanai/company"
          className={
            next
              ? 'inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-[var(--r-sm)] bg-[var(--paper)] px-4 text-sm font-black text-[var(--blue-deep)] ring-1 ring-[var(--blue-line)] hover:bg-[var(--blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
              : 'inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--paper)] px-3 py-2 text-xs font-black text-[var(--blue-deep)] ring-1 ring-[var(--blue-line)] hover:bg-[var(--blue-soft)]'
          }
        >
          会社情報を登録する
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}
