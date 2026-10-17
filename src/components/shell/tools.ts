// ============================================
// 共通シェル（AppShell）のツール一覧
// ============================================
// 経営ホームから全ツールへ行けるようにするための並び。
// ⚠️ ここはナビの表示だけ。各ツールの認可・課金判定はツール側が持つ（ここで判定しない）。
// ⚠️ 新しいツールを足すときは href が実在するか（src/app/<id>）を確認すること。
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Briefcase, FileText, Users, Clock, FolderKanban, Image as ImageIcon, Search,
  Presentation, Sparkles, MessageSquare, Video, Mic, Link2, ListChecks, UserCheck, PenTool, Globe, Building2,
} from 'lucide-react'

export interface ShellTool {
  id: string
  name: string
  href: string
  icon: LucideIcon
  /** ホームのエージェントが参照する短い説明 */
  hint: string
}

export interface ShellGroup {
  label: string
  tools: ShellTool[]
}

export const SHELL_HOME: ShellTool = { id: 'home', name: '経営ホーム', href: '/home', icon: LayoutDashboard, hint: '売上・収入・予定をまとめて見る' }

export const SHELL_GROUPS: ShellGroup[] = [
  {
    label: '営業・売上',
    tools: [
      { id: 'sfa', name: '営業管理', href: '/sfa', icon: Briefcase, hint: '商談・パイプライン・タスク' },
      { id: 'quote', name: '見積', href: '/quote', icon: FileText, hint: '見積書の作成と確定' },
      { id: 'shodan', name: '商談準備', href: '/shodan', icon: Building2, hint: '企業リサーチと提案資料' },
      { id: 'aishodan', name: 'AI商談', href: '/aishodan', icon: MessageSquare, hint: '商談の記録と要約' },
      { id: 'doyalist', name: 'リスト作成', href: '/doyalist', icon: ListChecks, hint: '営業リストの作成' },
    ],
  },
  {
    label: '人・組織',
    tools: [
      { id: 'hr', name: '人事', href: '/hr/dashboard', icon: Users, hint: '社員・評価・1on1' },
      { id: 'kintai', name: '勤怠', href: '/kintai/dashboard', icon: Clock, hint: '打刻・残業・申請' },
      { id: 'mensetsu', name: '面接', href: '/mensetsu', icon: UserCheck, hint: '採用面接の準備と記録' },
    ],
  },
  {
    label: 'プロジェクト',
    tools: [
      { id: 'promane', name: 'プロマネ', href: '/promane', icon: FolderKanban, hint: '案件・工数・収支' },
    ],
  },
  {
    label: '集客・制作',
    tools: [
      { id: 'banner', name: 'バナー', href: '/banner', icon: ImageIcon, hint: '広告バナーの制作' },
      { id: 'lp', name: 'LP', href: '/lp', icon: Globe, hint: 'ランディングページ制作' },
      { id: 'seo', name: '記事作成', href: '/seo', icon: PenTool, hint: 'SEO記事の作成' },
      { id: 'aio', name: 'AI検索対策', href: '/aio', icon: Search, hint: 'AI検索での見え方' },
      { id: 'doyaslide', name: 'スライド', href: '/doyaslide', icon: Presentation, hint: '資料・スライド作成' },
      { id: 'copy', name: 'コピー', href: '/copy', icon: Sparkles, hint: '広告コピーの作成' },
      { id: 'movie', name: '動画', href: '/movie', icon: Video, hint: '動画制作' },
      { id: 'interview', name: 'インタビュー', href: '/interview', icon: Mic, hint: '取材記事の作成' },
      { id: 'asklink', name: '質問リンク', href: '/asklink', icon: Link2, hint: '匿名の質問受付' },
    ],
  },
]

export const ALL_SHELL_TOOLS: ShellTool[] = [SHELL_HOME, ...SHELL_GROUPS.flatMap((g) => g.tools)]
