// ============================================
// 共通シェル（AppShell）のツール一覧
// ============================================
// ⚠️ 正本は src/lib/services.ts。表示するツール・リンク先・公開状態はそこから作る。
//    ここに持つのは「どの区分（stage）に並べるか・アイコン・一言説明・見出しの帯の説明」の対応表だけ。
//    ⚠️ ツール名はここに持たない。メニュー・見出し・パンくず・料金の画面は、services.ts の name を1つだけ使う（UX 点検 TRM-01・FRM-08）
//    - 提供終了（RETIRED_SERVICE_IDS）は getActiveServices() が外すので、ここに残っていても出ない
//    - 開発中（UNLISTED_SERVICE_IDS）は「開発中」バッジ付きで出る（ログイン後の画面だけで使う）
//    - 開発中のベータ版（services.ts の hidden: 'beta'）は getActiveServices() が外すので、メニュー・⌘K・最近使ったツールに出ない
//    - services.ts に新しいツールが入ると、対応表に無くても「その他」に自動で出る
// ⚠️ ここはナビの表示だけ。各ツールの認可・課金判定はツール側が持つ。
// 仕様: docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md §2・§8（U-1〜U-4）
import type { ShellIconName } from './icons'
import { BETA_HIDDEN_SERVICE_IDS, getActiveServices, getServiceById, UNLISTED_SERVICE_IDS, type Service } from '@/lib/services'

export type ShellStage = 'sell' | 'collect' | 'hire' | 'operate' | 'other'

export interface ShellTool {
  id: string
  name: string
  href: string
  /** アイコンの名前（src/components/shell/icons.tsx の対応表）。部品そのものは持たない */
  icon: ShellIconName
  /** ホームとサイドバーのツールチップに出す一言説明 */
  hint: string
  /** 見出しの帯（ToolFrame）に出す、何ができるかの一文。ToolFrame に description が無いときに使う */
  lead?: string
  stage: ShellStage
  /** 開発中（ログイン後だけで使う） */
  beta?: boolean
}

export interface ShellGroup {
  stage: ShellStage
  label: string
  tools: ShellTool[]
}

interface ToolMeta { stage: ShellStage; icon: ShellIconName; hint: string; lead: string; href?: string }

/** 区分・アイコン・一言説明・帯の説明の対応表（services.ts に無い id は出ない） */
const TOOL_META: Record<string, ToolMeta> = {
  // 売る
  sfa: { stage: 'sell', icon: 'Briefcase', hint: '商談・パイプライン・タスク', lead: '取引先・商談・タスクを、チームで1か所にまとめて管理します。' },
  shodan: { stage: 'sell', icon: 'Building2', hint: '企業リサーチと提案資料', lead: '商談先のURLから企業を調べ、提案資料とスライドを作ります。' },
  aishodan: { stage: 'sell', icon: 'MessageSquare', hint: '商談の記録と要約', lead: '発行したURLを開いてもらうと、AIが一次商談を代わりに進めます。' },
  cunning: { stage: 'sell', icon: 'Headphones', hint: 'Web会議の回答をその場で提示', lead: 'Web会議の相手の質問に、AIが回答の案をその場で出します。' },
  doyalist: { stage: 'sell', icon: 'ListChecks', hint: '営業リストの作成', lead: '業種と地域から営業リストを作り、営業文もまとめて用意します。' },
  doyaslide: { stage: 'sell', icon: 'Presentation', hint: '提案資料・スライド作成', lead: 'テーマを入れると、AIが提案資料のスライドを1枚ずつ作ります。' },
  // 集める
  aio: { stage: 'collect', icon: 'Search', hint: 'AI検索での見え方を確認', lead: 'ChatGPTなどのAIの回答に、自社がどう出るかを調べて比べます。' },
  seo: { stage: 'collect', icon: 'PenTool', hint: 'SEO記事の作成', lead: 'キーワードから、検索とAIに強い長文の記事を作ります。' },
  banner: { stage: 'collect', icon: 'Image', hint: 'バナーの制作', lead: '用途とサイズを選ぶと、AIが広告やSNSのバナーを作ります。' },
  adimage: { stage: 'collect', icon: 'Megaphone', hint: '媒体ごとの広告画像をまとめて作成', lead: 'URLを貼ると、媒体ごとにサイズのそろった広告画像を作ります。' },
  persona: { stage: 'collect', icon: 'CircleUser', hint: 'ターゲット像の作成', lead: 'ターゲットの人物像を、AIが具体的なペルソナにまとめます。' },
  interview: { stage: 'collect', icon: 'Mic', hint: '取材音声から記事を作成', lead: '取材の音声から、AIが文字起こしとインタビュー記事を作ります。' },
  asklink: { stage: 'collect', icon: 'Link2', hint: 'サイトに置く「AIに聞く」リンクとバナー', lead: 'サイトのURLから「AIに聞く」リンクと、案内用のバナーを作ります。' },
  popup: { stage: 'collect', icon: 'MousePointerClick', hint: 'サイトに出すポップアップの作成と計測', lead: 'URLを入れると、AIがサイトに合ったポップアップを提案します。' },
  tenjikai: { stage: 'collect', icon: 'Store', hint: '出展計画・制作物・予算・準備タスク', lead: 'URLと出展条件から、ブース・制作物・予算・締切をまとめて用意します。' },
  // 人
  hr: { stage: 'hire', icon: 'Users', hint: '社員・評価・1on1', href: '/hr/dashboard', lead: '社員の情報・評価・1on1を1か所で管理し、人を活かします。' },
  mensetsu: { stage: 'hire', icon: 'UserCheck', hint: '採用面接の準備と記録', lead: 'AIが一次面接を行い、評価のレポートまで残します。' },
  shanai: { stage: 'hire', icon: 'BookOpen', hint: '社員インタビューから採用広報の記事を作成', lead: '録音かアンケートと写真から、社員インタビューの記事を作ります。' },
  kintai: { stage: 'hire', icon: 'Clock', hint: '打刻・残業・申請', href: '/kintai/dashboard', lead: '打刻・残業・休暇の申請と承認を、ブラウザでまとめて管理します。' },
  // 回す
  quote: { stage: 'operate', icon: 'FileText', hint: '見積書の作成と確定', lead: 'サービスのURLから相場つきの品目を並べ、見積書のPDFを作ります。' },
  promane: { stage: 'operate', icon: 'FolderKanban', hint: '案件・工数・収支', lead: '案件の進み具合・工数・収支を、1か所でまとめて管理します。' },
  income: { stage: 'operate', icon: 'Receipt', hint: '契約・売上予定・請求書・入金', lead: '契約から毎月の売上予定を作り、請求書の発行と入金を確かめます。' },
  expense: { stage: 'operate', icon: 'Wallet', hint: '固定費・業務委託・支払予定', lead: '契約ごとの支払いを登録し、毎月の出金と先の予定を見ます。' },
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

function toShellTool(s: Service): ShellTool {
  const meta = TOOL_META[s.id]
  return {
    id: s.id,
    name: s.name,
    href: meta?.href ?? s.href,
    icon: meta?.icon ?? 'LayoutGrid',
    hint: meta?.hint ?? s.description,
    lead: meta?.lead,
    stage: meta?.stage ?? 'other',
    beta: UNLISTED_SERVICE_IDS.has(s.id) || undefined,
  }
}

function buildTools(): ShellTool[] {
  return [...getActiveServices()].sort((a, b) => orderOf(a.id) - orderOf(b.id)).map(toShellTool)
}

const TOOLS = buildTools()

function groupsOf(labels: { stage: ShellStage; label: string }[], tools: ShellTool[]): ShellGroup[] {
  return labels
    .map(({ stage, label }) => ({ stage, label, tools: tools.filter((t) => t.stage === stage) }))
    .filter((g) => g.tools.length > 0)
}

export const SHELL_GROUPS: ShellGroup[] = groupsOf(STAGE_LABELS, TOOLS)

export const ALL_SHELL_TOOLS: ShellTool[] = [SHELL_HOME, ...TOOLS]

/**
 * id からツールを引く（パンくず・見出しの名前用）。
 * 開発中のベータ版（hidden: 'beta'）は一覧に無いが、許可した人は開けるので、ここでは引けるようにする。
 * ⚠️ 一覧（メニュー・⌘K・最近使ったツール）には ALL_SHELL_TOOLS を使う。これを使わない。
 */
export function findShellTool(id: string): ShellTool | undefined {
  const listed = ALL_SHELL_TOOLS.find((t) => t.id === id)
  if (listed) return listed
  const svc = BETA_HIDDEN_SERVICE_IDS.has(id) ? getServiceById(id) : undefined
  return svc ? toShellTool(svc) : undefined
}
