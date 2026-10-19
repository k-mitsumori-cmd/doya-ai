// ============================================
// 共通シェル（AppShell）のツール一覧
// ============================================
// ⚠️ 正本は src/lib/services.ts。表示するツール・リンク先・公開状態はそこから作る。
//    ここに持つのは「どの区分（stage）に並べるか・サイドバーでの短い名前・アイコン・一言説明」の対応表だけ。
//    - 提供終了（RETIRED_SERVICE_IDS）は getActiveServices() が外すので、ここに残っていても出ない
//    - 開発中（UNLISTED_SERVICE_IDS）は「開発中」バッジ付きで出る（ログイン後の画面だけで使う）
//    - services.ts に新しいツールが入ると、対応表に無くても「その他」に自動で出る
// ⚠️ ここはナビの表示だけ。各ツールの認可・課金判定はツール側が持つ。
// 仕様: docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md §2・§8（U-1〜U-4）
import type { ShellIconName } from './icons'
import { getActiveServices, UNLISTED_SERVICE_IDS } from '@/lib/services'

export type ShellStage = 'sell' | 'collect' | 'hire' | 'operate' | 'other'

export interface ShellTool {
  id: string
  name: string
  href: string
  /** アイコンの名前（src/components/shell/icons.tsx の対応表）。部品そのものは持たない */
  icon: ShellIconName
  /** ホームとサイドバーのツールチップに出す一言説明 */
  hint: string
  stage: ShellStage
  /** 開発中（ログイン後だけで使う） */
  beta?: boolean
}

export interface ShellGroup {
  stage: ShellStage
  label: string
  tools: ShellTool[]
}

interface ToolMeta { stage: ShellStage; name: string; icon: ShellIconName; hint: string; href?: string }

/** 区分・短い名前・アイコン・一言説明の対応表（services.ts に無い id は出ない） */
const TOOL_META: Record<string, ToolMeta> = {
  // 売る
  sfa: { stage: 'sell', name: '営業管理', icon: 'Briefcase', hint: '商談・パイプライン・タスク' },
  shodan: { stage: 'sell', name: '商談準備', icon: 'Building2', hint: '企業リサーチと提案資料' },
  aishodan: { stage: 'sell', name: 'AI商談', icon: 'MessageSquare', hint: '商談の記録と要約' },
  cunning: { stage: 'sell', name: 'カンニング', icon: 'Headphones', hint: 'Web会議の回答をその場で提示' },
  doyalist: { stage: 'sell', name: 'リスト作成', icon: 'ListChecks', hint: '営業リストの作成' },
  doyaslide: { stage: 'sell', name: 'スライド', icon: 'Presentation', hint: '提案資料・スライド作成' },
  // 集める
  aio: { stage: 'collect', name: 'AI検索対策', icon: 'Search', hint: 'AI検索での見え方を確認' },
  seo: { stage: 'collect', name: '記事作成', icon: 'PenTool', hint: 'SEO記事の作成' },
  banner: { stage: 'collect', name: 'バナー', icon: 'Image', hint: 'バナーの制作' },
  adimage: { stage: 'collect', name: '広告画像', icon: 'Megaphone', hint: '媒体ごとの広告画像をまとめて作成' },
  persona: { stage: 'collect', name: 'ペルソナ', icon: 'CircleUser', hint: 'ターゲット像の作成' },
  interview: { stage: 'collect', name: 'インタビュー', icon: 'Mic', hint: '取材音声から記事を作成' },
  asklink: { stage: 'collect', name: '質問リンク', icon: 'Link2', hint: 'サイトに置く「AIに聞く」リンクとバナー' },
  popup: { stage: 'collect', name: 'ポップアップ', icon: 'MousePointerClick', hint: 'サイトに出すポップアップの作成と計測' },
  tenjikai: { stage: 'collect', name: '展示会', icon: 'Store', hint: '出展計画・制作物・予算・準備タスク' },
  // 人
  hr: { stage: 'hire', name: '人事', icon: 'Users', hint: '社員・評価・1on1', href: '/hr/dashboard' },
  mensetsu: { stage: 'hire', name: '面接', icon: 'UserCheck', hint: '採用面接の準備と記録' },
  shanai: { stage: 'hire', name: '社内インタビュー', icon: 'BookOpen', hint: '社員インタビューから採用広報の記事を作成' },
  kintai: { stage: 'hire', name: '勤怠', icon: 'Clock', hint: '打刻・残業・申請', href: '/kintai/dashboard' },
  // 回す
  quote: { stage: 'operate', name: '見積', icon: 'FileText', hint: '見積書の作成と確定' },
  promane: { stage: 'operate', name: 'プロマネ', icon: 'FolderKanban', hint: '案件・工数・収支' },
  income: { stage: 'operate', name: '収入管理', icon: 'Receipt', hint: '契約・売上予定・請求書・入金' },
  expense: { stage: 'operate', name: '支出管理', icon: 'Wallet', hint: '固定費・業務委託・支払予定' },
}

const STAGE_LABELS: { stage: ShellStage; label: string }[] = [
  // 事業の部門の名前にする（UI 品質 H-1）。並びは、集客 → 営業 → 人 → お金
  { stage: 'collect', label: 'マーケティング' },
  { stage: 'sell', label: '営業（セールス）' },
  { stage: 'hire', label: '採用・人材管理' },
  { stage: 'operate', label: '経理・バックオフィス' },
  { stage: 'other', label: 'その他' },
]

export const SHELL_HOME: ShellTool = {
  id: 'home', name: '経営ホーム', href: '/home', icon: 'LayoutDashboard', hint: '売上・収入・予定をまとめて見る', stage: 'other',
}

/** 区分の中は対応表の並び（よく使う順）。対応表に無いものは services.ts の順で後ろに */
const META_ORDER = Object.keys(TOOL_META)
const orderOf = (id: string) => {
  const i = META_ORDER.indexOf(id)
  return i === -1 ? META_ORDER.length : i
}

function buildTools(): ShellTool[] {
  return [...getActiveServices()].sort((a, b) => orderOf(a.id) - orderOf(b.id)).map((s) => {
    const meta = TOOL_META[s.id]
    return {
      id: s.id,
      name: meta?.name ?? s.shortName ?? s.name,
      href: meta?.href ?? s.href,
      icon: meta?.icon ?? 'LayoutGrid',
      hint: meta?.hint ?? s.description,
      stage: meta?.stage ?? 'other',
      beta: UNLISTED_SERVICE_IDS.has(s.id) || undefined,
    }
  })
}

const TOOLS = buildTools()

export const SHELL_GROUPS: ShellGroup[] = STAGE_LABELS
  .map(({ stage, label }) => ({ stage, label, tools: TOOLS.filter((t) => t.stage === stage) }))
  .filter((g) => g.tools.length > 0)

export const ALL_SHELL_TOOLS: ShellTool[] = [SHELL_HOME, ...TOOLS]
