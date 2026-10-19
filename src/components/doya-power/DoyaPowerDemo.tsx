'use client'
// 開発用プレビュー: ドヤパワーの部品の見本（/ds-preview/doya-power）。値はすべてこの中の見本の数字。
// ⚠️ 本番では 404（ds-preview の layout が止める）。台帳にはつながない。
import { useState } from 'react'
import { Button, Card } from '@/components/ds'
import { CostBadge, DoyaPowerGauge, LowPowerNotice, MorningRecoveryToast, PowerEquivalents, type DoyaPowerFx, type PowerConversion } from './index'

const LIMIT = 1000
const CONVERSIONS: PowerConversion[] = [
  { id: 'banner', label: 'バナー', unit: '枚', cost: 10, icon: 'Image' },
  { id: 'seo', label: '記事', unit: '本', cost: 3, icon: 'FileText' },
  { id: 'slide', label: '資料', unit: '件', cost: 25, icon: 'Presentation' },
]
// 画面の写真が日によって変わらないよう、時刻は固定する
const NOW = '2026-10-19T14:00:00+09:00'
const NEXT_RECOVERY = '2026-10-20T06:00:00+09:00'
const RECOVERED = '2026-10-19T06:00:00+09:00'

const LEVELS = [
  { id: 'full', label: '満タン', value: 1000 },
  { id: 'mid', label: '半分くらい', value: 330 },
  { id: 'low', label: '少ない', value: 80 },
  { id: 'zero', label: '使い切り', value: 0 },
] as const

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 36, whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} />
      {label}
    </label>
  )
}

export default function DoyaPowerDemo() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]['id']>('mid')
  const [orgMascot, setOrgMascot] = useState(true)
  const [orgFx, setOrgFx] = useState(true)
  const [userMascot, setUserMascot] = useState(true)
  const [userFx, setUserFx] = useState(true)
  const remaining = LEVELS.find((l) => l.id === level)!.value
  const fx: DoyaPowerFx = { org: { mascot: orgMascot, effects: orgFx }, user: { mascot: userMascot, effects: userFx } }
  const quiet: DoyaPowerFx = { org: { mascot: false, effects: false } }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, minWidth: 0 }}>
      <Card title="見本の切り替え" icon="Settings">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LEVELS.map((l) => (
              <Button key={l.id} size="sm" variant={level === l.id ? 'primary' : 'secondary'} onClick={() => setLevel(l.id)}>{l.label}</Button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px 20px', flexWrap: 'wrap' }}>
            <Toggle label="組織: ドヤくん" checked={orgMascot} onChange={setOrgMascot} />
            <Toggle label="組織: 演出" checked={orgFx} onChange={setOrgFx} />
            <Toggle label="個人: ドヤくん" checked={userMascot} onChange={setUserMascot} />
            <Toggle label="個人: 演出" checked={userFx} onChange={setUserFx} />
          </div>
        </div>
      </Card>

      <DoyaPowerGauge remaining={remaining} limit={LIMIT} conversions={CONVERSIONS} nextRecoveryAt={NEXT_RECOVERY} now={NOW} fx={fx} />

      <Card title="静かな表示（演出とドヤくんをオフ）" icon="Settings">
        <DoyaPowerGauge remaining={remaining} limit={LIMIT} conversions={CONVERSIONS} nextRecoveryAt={NEXT_RECOVERY} now={NOW} fx={quiet} />
      </Card>

      <Card title="残りの言い換え" icon="ListChecks">
        <div style={{ display: 'grid', gap: 12 }}>
          <PowerEquivalents remaining={remaining} conversions={CONVERSIONS} />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
            換算の表（1回あたりの量）は props で渡します。例: バナー 10 / 記事 3 / 資料 25。
          </p>
        </div>
      </Card>

      <Card title="ボタンに減る量を付ける" icon="MousePointerClick">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button icon="Image">バナーを作る<CostBadge cost={10} /></Button>
          <Button variant="secondary" icon="FileText">記事を書く<CostBadge cost={3} /></Button>
          <Button variant="ghost" size="sm" icon="Presentation">資料にする<CostBadge cost={25} /></Button>
          <Button variant="secondary" icon="Presentation" disabled>資料にする<CostBadge cost={25} short /></Button>
        </div>
      </Card>

      <Card title="残りが少ないとき" icon="Lightbulb">
        <div style={{ display: 'grid', gap: 12 }}>
          <LowPowerNotice remaining={80} limit={LIMIT} conversions={CONVERSIONS} nextRecoveryAt={NEXT_RECOVERY} now={NOW} moreHref="#more" fx={fx} />
          <LowPowerNotice remaining={0} limit={LIMIT} nextRecoveryAt={NEXT_RECOVERY} now={NOW} moreHref="#more" fx={quiet} />
        </div>
      </Card>

      <Card title="朝の回復の知らせ" icon="Sparkles">
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
            ふだんは画面の右下に重ねて、日本時間で1日1回だけ出します。見本では、その場に置いて毎回出しています。
          </p>
          <MorningRecoveryToast recoveredAt={RECOVERED} limit={LIMIT} conversions={CONVERSIONS} fx={fx} placement="inline" ignoreStorage autoHideMs={0} />
          <MorningRecoveryToast recoveredAt={RECOVERED} limit={LIMIT} amount={600} fx={quiet} placement="inline" ignoreStorage autoHideMs={0} />
        </div>
      </Card>
    </div>
  )
}
