'use client'

// ドヤ収入管理: 新しい見た目（UI 品質の直し）の部品
// ⚠️ 新しい見た目で使う。）
// ⚠️ 計算・集計はしない。数字は API の値をそのまま受け取って表示するだけ
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button as DsButton, ToolHero } from '@/components/ds'
import { AreaChart, Ring } from '@/components/ds/charts'
import { CountUp, Stagger, StaggerItem } from '@/components/ds/motion'
import { Card, fetchJson, s, useResource, yen } from './ui'

/** 金額の数字の動き。null は「—」 */
export function YenCount({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <>—</>
  return <CountUp value={value} />
}

/** ダッシュボードの最初の帯（キービジュアル・一言・主ボタン） */
export function IncomeHero() {
  return (
    <ToolHero
      title="請求漏れを出さず、毎月の収入をひと目で"
      lead="契約を登録すると、毎月の売上予定が自動で並びます。請求書の発行から入金の確認まで、この画面で追えます。"
      action={<DsButton href="/income/contracts/new" icon="Plus">契約を登録する</DsButton>}
      tool="income"
    />
  )
}

/** 月別推移のグラフ（売上予定と入金）。表の上に出す */
export function TrendChart({ rows }: { rows: { month: string; revenue: number; received: number }[] }) {
  if (rows.length === 0) return null
  return (
    <AreaChart
      labels={rows.map((r) => `${Number(r.month.slice(5, 7))}月`)}
      series={[
        { name: '売上予定（税抜）', values: rows.map((r) => r.revenue) },
        { name: '入金', values: rows.map((r) => r.received), tone: 'cyan' },
      ]}
      format={(n) => yen(Math.round(n))}
    />
  )
}

type StepState = { issuer: boolean; clients: boolean; contracts: boolean }

/** はじめの3ステップ（進み具合つき。S-37）。売上予定がまだ無いときだけ出す */
export function OnboardingSteps() {
  // 読むだけ（作成・変更はしない）。失敗したら進み具合を出さずに手順だけ出す
  const res = useResource<StepState>(
    () => Promise.all([
      fetchJson<{ issuer: { companyName?: string } | null }>('/api/income/issuer'),
      fetchJson<{ clients: unknown[] }>('/api/income/clients'),
      fetchJson<{ contracts: unknown[] }>('/api/income/contracts'),
    ]).then(([i, c, k]) => ({ issuer: !!i.issuer?.companyName, clients: c.clients.length > 0, contracts: k.contracts.length > 0 })),
    'onboarding',
  )
  const st = res.data
  // 契約から始める順（2026-10-26。取引先は契約の画面で名前だけ登録でき、詳しい項目はあとから足す）
  const steps = [
    { done: st?.contracts, title: '契約を登録する', body: '月額と期間を入れると、月ごとの売上予定が自動で作られます。取引先も同じ画面で登録できます。', href: '/income/contracts/new', cta: '契約を登録する', art: '/income/step-1.webp' },
    { done: st?.issuer, title: '請求元を登録する', body: '自社名と振込先を入れると、請求書に載ります。請求書を確定する前に登録します。', href: '/income/settings', cta: '設定を開く', art: '/income/step-2.webp' },
    { done: st?.clients, title: '取引先の請求先を整える', body: '請求書の宛先と、支払条件（締め日・支払日）を足します。', href: '/income/clients', cta: '取引先を開く', art: '/income/step-3.webp' },
  ]
  const doneCount = steps.filter((x) => x.done).length
  const next = steps.findIndex((x) => !x.done)
  return (
    <Card
      title="はじめの3ステップ"
      right={st ? (
        <Ring value={doneCount / 3} size={56} label={`3ステップのうち ${doneCount} つ完了`}>
          <span className={`${s.num} ${s.strong}`} style={{ fontSize: 13 }}>{doneCount}/3</span>
        </Ring>
      ) : undefined}
    >
      <Stagger as="ol" className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {steps.map((x, i) => (
          <StaggerItem as="li" index={i} key={x.title}>
            <div
              className="flex h-full flex-col overflow-hidden rounded-[var(--r)] border bg-[var(--paper)]"
              style={{ borderColor: i === next ? 'var(--blue)' : 'var(--line)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.art} alt="" width={1200} height={800} loading="lazy" className="aspect-[3/2] w-full bg-[var(--bg)] object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="m-0 flex items-center gap-2 text-[15px] font-bold text-[var(--ink)]">
                  <span
                    className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] ${s.num}`}
                    style={x.done ? { background: 'var(--ok-bg)', color: 'var(--ok-ink)' } : { background: 'var(--blue-soft)', color: 'var(--blue-deep)' }}
                    aria-hidden="true"
                  >
                    {x.done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className="min-w-0">{x.title}</span>
                  {x.done && <span className="sr-only">（完了）</span>}
                </p>
                <p className="m-0 text-[14px] leading-[1.7] text-[var(--sub)]">{x.body}</p>
                <Link href={x.href} className={s.link} style={{ marginTop: 'auto' }}>{x.done ? '確認する' : x.cta}</Link>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Card>
  )
}
