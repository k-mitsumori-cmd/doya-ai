// ============================================
// 共通シェルのアイコン（名前の文字列 → lucide の部品）
// ============================================
// ⚠️ ナビやツール一覧のアイコンは「名前の文字列」で持つ。
//    lucide の部品（関数）をサーバーの layout.tsx からクライアント部品（ToolFrame / AppShell）へ渡すと、
//    「Functions cannot be passed directly to Client Components」で全画面が 500 になる。
//    ビルドは通り、画面を開いたときに初めて落ちるので気づきにくい（2026-10-18 収入管理で発覚）。
// ⚠️ 新しい名前を使うときは、ここの対応表に足す。無い名前は既定のアイコン（LayoutGrid）になる。
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  BadgeJapaneseYen, BarChart3, BookOpen, BookUser, Box, Briefcase, Building2, Calendar, CalendarClock, CalendarRange,
  CircleUser, Clock, CreditCard, FileSignature, FileText, FolderKanban, FolderOpen, Gift, Headphones, Home, Image,
  LayoutDashboard, LayoutGrid, LineChart, Link2, List, ListChecks, Megaphone, MessageSquare, Mic, MousePointerClick,
  Palette, PanelTopOpen, PenTool, Plus, PlusCircle, Presentation, Receipt, RotateCcw, Search, Settings, Store,
  Truck, UserCheck, UserRound, Users, Wallet, History, LayoutTemplate, Tag, Target,
} from 'lucide-react'

export const SHELL_ICONS = {
  BadgeJapaneseYen, BarChart3, BookOpen, BookUser, Box, Briefcase, Building2, Calendar, CalendarClock, CalendarRange,
  CircleUser, Clock, CreditCard, FileSignature, FileText, FolderKanban, FolderOpen, Gift, Headphones, Home, Image,
  LayoutDashboard, LayoutGrid, LineChart, Link2, List, ListChecks, Megaphone, MessageSquare, Mic, MousePointerClick,
  Palette, PanelTopOpen, PenTool, Plus, PlusCircle, Presentation, Receipt, RotateCcw, Search, Settings, Store,
  Truck, UserCheck, UserRound, Users, Wallet, History, LayoutTemplate, Tag, Target,
} satisfies Record<string, LucideIcon>

/** 対応表にある名前。対応表に無い文字列も受け付ける（既定のアイコンになる） */
export type ShellIconName = keyof typeof SHELL_ICONS | (string & {})

export function resolveShellIcon(name?: string): LucideIcon {
  return (name && (SHELL_ICONS as Record<string, LucideIcon>)[name]) || LayoutGrid
}

export function ShellIcon({ name, ...props }: { name?: ShellIconName } & LucideProps) {
  const Icon = resolveShellIcon(name)
  return <Icon aria-hidden {...props} />
}
