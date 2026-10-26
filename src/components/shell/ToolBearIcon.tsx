// ============================================
// 左のメニューのツールのアイコン（ドヤくんがツールに合った行動をしている絵）
// ============================================
// 絵は public/shell/bear/<ツールid>.webp（128×128・透過・白い縁取り）。作り方とプロンプトは docs/design/images/shell-bear/PROMPTS.md
// ⚠️ 絵の無いツール（経営ホーム・新しく増えたツール）は、今までどおり lucide のアイコン（tools.ts の icon の名前）を出す。
//    新しいツールを足したら、絵を作って BEAR_TOOL_IDS に足す。
// ⚠️ public/renewal/icons（LP とトップのサービス一覧の絵）とは別の絵。そちらは上書きしない。
import { ShellIcon, type ShellIconName } from './icons'
import styles from './ToolBearIcon.module.css'

export const BEAR_TOOL_IDS: ReadonlySet<string> = new Set([
  // マーケティング
  'aio', 'seo', 'banner', 'adimage', 'persona', 'interview', 'asklink', 'popup', 'tenjikai',
  // 営業（セールス）
  'sfa', 'shodan', 'aishodan', 'cunning', 'doyalist', 'doyaslide',
  // 採用・人材管理
  'hr', 'mensetsu', 'shanai', 'kintai',
  // 経理・バックオフィス
  'quote', 'promane', 'income', 'expense',
])

export function ToolBearIcon({ id, icon, size = 32, iconSize = 18 }: {
  id: string
  /** 絵が無いときに出す lucide のアイコンの名前 */
  icon?: ShellIconName
  /** 絵の大きさ（px） */
  size?: number
  /** 絵が無いときの lucide のアイコンの大きさ（px） */
  iconSize?: number
}) {
  if (!BEAR_TOOL_IDS.has(id)) return <ShellIcon name={icon} size={iconSize} strokeWidth={2} />
  return (
    // 小さな固定の絵なので next/image の変換は通さない（幅と高さを決めて、読み込みでずれないようにする）
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/shell/bear/${id}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
      draggable={false}
      className={styles.bear}
    />
  )
}
