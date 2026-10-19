// ============================================
// ドヤカンニング モードのアイコン（新しい見た目で、絵文字の代わりに使う）
// ============================================
// ⚠️ モードの定義（src/lib/cunning/modes.ts の icon）は絵文字のまま。今の見た目では今までどおり絵文字を出す。
//    新しい見た目（useUiNext()）のときだけ、ここの lucide のアイコンを出す（絵文字をアイコンに使わない）。
import { UiIcon, type UiIconName } from '@/components/icons'

const MODE_ICON: Record<string, UiIconName> = {
  sales: 'target',
  interview: 'user',
  oneonone: 'users',
  grilling: 'warning',
  apology: 'note',
  idol: 'star',
  roast: 'energy',
  stream: 'play',
  ogiri: 'celebrate',
  praise: 'trophy',
  debate: 'idea',
}

export function CunningModeIcon({ mode, size = 18, className }: { mode: string; size?: number; className?: string }) {
  return <UiIcon name={MODE_ICON[mode] ?? 'mic'} size={size} className={className} />
}
