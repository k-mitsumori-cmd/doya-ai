'use client'

// ドヤリストの画面のアイコン。
// 新しい見た目（useUiNext()。UI 品質 S-52）では lucide にし、今の見た目では Material Symbols のまま出す。
// ⚠️ className は今の見た目の文字の大きさ（text-xs〜text-3xl）をそのまま受け取り、lucide の大きさに読み替える。
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, ArrowUp, ArrowUpRight, BarChart3, Building2, Bot, AlertCircle, HelpCircle, Clock, DownloadCloud, Download, FileText, Gem, Globe,
  Headphones, Info, LogIn, SlidersHorizontal, UserCircle, Lightbulb, ListChecks, LogOut, Mail, Map as MapIcon, MapPin, Radio, Reply, Search, Sparkles, User, Users,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  apartment: Building2, arrow_outward: ArrowUpRight, arrow_upward: ArrowUp, auto_awesome: Sparkles, bar_chart: BarChart3,
  cell_tower: Radio, checklist: ListChecks, cloud_download: DownloadCloud, description: FileText, diamond: Gem, download: Download,
  error: AlertCircle, groups: Users, help: HelpCircle, info: Info, language: Globe, lightbulb: Lightbulb, location_on: MapPin,
  logout: LogOut, mail: Mail, map: MapIcon, person: User, reply: Reply, schedule: Clock, search: Search, smart_toy: Bot,
  support_agent: Headphones, warning: AlertTriangle, account_circle: UserCircle, login: LogIn, tune: SlidersHorizontal,
}

const SIZE: [string, number][] = [['text-3xl', 28], ['text-2xl', 24], ['text-xl', 20], ['text-lg', 18], ['text-base', 16], ['text-sm', 14], ['text-xs', 12]]

export default function Sym({ name, className = '' }: { name: string; className?: string }) {
  const Icon = ICONS[name]
  if (!Icon) return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
  const size = SIZE.find(([c]) => className.split(/\s+/).includes(c))?.[1] ?? 18
  // 文字の大きさのクラスは外し、色・余白・並びのクラスだけを残す
  const rest = className.split(/\s+/).filter((c) => c && !SIZE.some(([s]) => s === c)).join(' ')
  return <Icon size={size} strokeWidth={1.75} aria-hidden className={`inline-block shrink-0 ${rest}`} />
}
