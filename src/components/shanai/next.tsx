'use client'

// ドヤ社内インタビュー: 新しい見た目（UI 品質の直し）の部品
// ⚠️ useUiNext() が真のときだけ使う。偽のときは今までの部品のまま（チェックリスト §5.1）
// ⚠️ 一覧の数を数えて見せるだけ。API・集計のロジックは変えない
import Link from 'next/link'
import { ArrowRight, ClipboardList, Image as ImageIcon, Mic } from 'lucide-react'
import { Button as DsButton, Card, EmptyState, StatTile, ToolHero } from '@/components/ds'
import { CountUp, Stagger, StaggerItem } from '@/components/ds/motion'
import type { ShanaiRow } from '@/app/(shell)/shanai/Tool'
import { useInShanaiShell } from './shell-context'
import { StatusBadge } from './ui'

/** 一覧の最初の帯（キービジュアル・一言・主ボタン） */
export function ShanaiHero() {
  // 共通の枠の外（ToolFrame が無い）では、ページの見出し（h1）をここで1つ持つ
  const inShell = useInShanaiShell()
  return (
    <>
      {!inShell && <h1 className="sr-only">ドヤ社内インタビュー</h1>}
      <ToolHero
        title="社員の声を、採用に効く記事に"
        lead="録音をアップロードするか、社員にアンケートを送るだけ。写真と会社情報を合わせて、会社の魅力が伝わるインタビュー記事に仕上げます。"
        action={<DsButton href="/shanai/new" icon="Plus">インタビューを作る</DsButton>}
        tool="shanai"
      />
    </>
  )
}

/** 数字の並び（インタビューの数・記事ができた数・作成中・写真） */
export function ShanaiStats({ rows }: { rows: ShanaiRow[] }) {
  const done = rows.filter((r) => r.status === 'DONE').length
  const photos = rows.reduce((a, r) => a + r.photoCount, 0)
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label="インタビュー" value={<CountUp value={rows.length} />} unit="件" icon="Mic" />
      <StatTile label="記事ができた" value={<CountUp value={done} />} unit="件" icon="FileText" />
      <StatTile label="作成中" value={<CountUp value={rows.length - done} />} unit="件" icon="PenTool" />
      <StatTile label="写真" value={<CountUp value={photos} />} unit="枚" icon="Image" />
    </div>
  )
}

const STEPS = [
  { title: '会社情報を登録する', body: '会社サイトのURLから、ミッション・事業・制度を読み取ります。', href: '/shanai/company', cta: '会社情報を開く', art: '/shanai/step-1.webp' },
  { title: '社員の声を集める', body: '録音をアップロードするか、アンケートのURLを社員に送ります。', href: '/shanai/new', cta: 'インタビューを作る', art: '/shanai/step-2.webp' },
  { title: '記事を仕上げる', body: '話の要点を確かめると、写真入りの記事ができます。', href: '/shanai/new', cta: '作り方を見る', art: '/shanai/step-3.webp' },
]

/** インタビューがまだ無いとき: 空状態の絵と、はじめの3ステップ */
export function ShanaiSteps() {
  return (
    <div className="space-y-6">
      <Card>
        <EmptyState
          art="/shanai/empty-interviews.webp"
          title="まだインタビューがありません"
          description="録音をアップロードするか、社員にアンケートを送ると、ここに並びます。"
          action={<DsButton variant="secondary" href="/shanai/new" icon="Plus">最初のインタビューを作る</DsButton>}
        />
      </Card>
      <Card title="はじめの3ステップ">
        <Stagger as="ol" className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
          {STEPS.map((st, i) => (
            <StaggerItem as="li" index={i} key={st.title}>
              <div className="flex h-full flex-col overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={st.art} alt="" width={1200} height={800} loading="lazy" className="aspect-[3/2] w-full bg-[var(--bg)] object-cover" />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="flex items-center gap-2 text-[15px] font-bold text-[var(--ink)]">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--blue-soft)] text-[12px] tabular-nums text-[var(--blue-deep)]" aria-hidden="true">{i + 1}</span>
                    <span className="min-w-0">{st.title}</span>
                  </p>
                  <p className="text-[14px] leading-[1.7] text-[var(--sub)]">{st.body}</p>
                  <Link href={st.href} className="mt-auto inline-flex min-h-11 items-center gap-1 self-start rounded-[var(--r-sm)] text-[14px] font-bold text-[var(--blue)] hover:text-[var(--blue-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]">
                    {st.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Card>
    </div>
  )
}

/** インタビューの一覧（カードが順に入る） */
export function ShanaiCardList({ rows }: { rows: ShanaiRow[] }) {
  return (
    <Stagger className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
      {rows.map((r, i) => (
        <StaggerItem index={i} key={r.id}>
          <Link
            href={`/shanai/interviews/${r.id}`}
            className="group block h-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--blue-line)] hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[var(--ink)]">{r.intervieweeName} さん</h3>
                <p className="mt-0.5 truncate text-[13px] text-[var(--sub)]">{[r.department, r.position].filter(Boolean).join(' / ') || '部署未設定'}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--blue)]" aria-hidden="true" />
            </div>
            {r.latestTitle && <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-[var(--sub)]">{r.latestTitle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[var(--sub)]">
              <StatusBadge status={r.status} />
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2 py-0.5">
                {r.mode === 'voice' ? <Mic className="h-3 w-3" aria-hidden="true" /> : <ClipboardList className="h-3 w-3" aria-hidden="true" />}
                {r.mode === 'voice' ? '録音' : 'アンケート'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2 py-0.5">
                <ImageIcon className="h-3 w-3" aria-hidden="true" />
                写真 {r.photoCount}枚
              </span>
              <span className="ml-auto whitespace-nowrap font-medium tabular-nums text-[var(--muted)]">{new Date(r.updatedAt).toLocaleDateString('ja-JP')}</span>
            </div>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  )
}
