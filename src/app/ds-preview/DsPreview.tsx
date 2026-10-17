'use client'
import { useState } from 'react'
import { FileText, Plus, Settings, TrendingUp, Wallet, Receipt } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import type { ShellNavItem } from '@/components/shell/nav'
import { Badge, Button, Card, EmptyState, Skeleton, StatTile } from '@/components/ds'

const NAV: ShellNavItem[] = [
  { label: '見積書', href: '/ds-preview', icon: FileText, exact: true },
  { label: '商品', href: '/ds-preview/products', icon: Receipt },
  { label: '設定', href: '/ds-preview/settings', icon: Settings },
]

export default function DsPreview() {
  const [state, setState] = useState<'ready' | 'loading' | 'empty' | 'error' | 'forbidden'>('ready')
  return (
    <AppShell userName="サンプル">
      <ToolFrame
        serviceId="quote"
        description="段0の見本です。各ツールはこの枠の中に既存のページをそのまま入れます。"
        action={<Button icon={Plus}>見積書をつくる</Button>}
        nav={NAV}
        aside={<Card title="ヒント"><p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>右ペインは 1280px 以上でだけ表示されます。</p></Card>}
      >
        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['ready', 'loading', 'empty', 'error', 'forbidden'] as const).map((s) => (
              <Button key={s} size="sm" variant={state === s ? 'primary' : 'secondary'} onClick={() => setState(s)}>
                {{ ready: '通常', loading: '読込中', empty: '空', error: 'エラー', forbidden: '権限なし' }[s]}
              </Button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <StatTile icon={TrendingUp} label="今月の受注" value="265" unit="万円" sub="4件" href="#" />
            <StatTile icon={FileText} label="確定した見積" value="320" unit="万円" sub="下書き 5件" />
            <StatTile icon={Wallet} label="受注見込み" value="782" unit="万円" sub="進行中 23件" />
            <StatTile label="未使用のツール" value="—" sub="まだ使い始めていません" muted />
          </div>
          <Card title="見積書" meta={<Badge tone="blue">3件</Badge>}>
            {state === 'ready' ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                {['Webサイト保守（年間）', '採用LP制作', '広告運用（11月）'].map((t, i) => (
                  <li key={t} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
                    <span>{t}</span>
                    <Badge tone={i === 0 ? 'ok' : 'note'}>{i === 0 ? '確定' : '下書き'}</Badge>
                  </li>
                ))}
              </ul>
            ) : state === 'loading' ? (
              <Skeleton lines={3} delayMs={0} />
            ) : state === 'empty' ? (
              <EmptyState kind="zero" title="まだ見積書がありません" description="商品やサービスのURLを入れるだけで、相場つきの見積もり品目ができます。" action={<Button icon={Plus}>最初の見積書をつくる</Button>} />
            ) : state === 'error' ? (
              <EmptyState kind="error" title="見積書を読み込めませんでした" description="通信が不安定な可能性があります。少し待ってからもう一度お試しください。" action={<Button variant="secondary" onClick={() => setState('ready')}>もう一度</Button>} />
            ) : (
              <EmptyState kind="forbidden" title="この組織の見積書を見る権限がありません" description="組織の管理者に、メンバーへの追加を依頼してください。" />
            )}
          </Card>
        </div>
      </ToolFrame>
    </AppShell>
  )
}
