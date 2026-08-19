import type { ComponentType, SVGProps } from 'react'
import {
  Check, Sparkles, Lightbulb, Palette, PartyPopper, StickyNote, BarChart3,
  User, Search, List, Target, Rocket, Building2, CalendarDays, CheckCircle2, Smartphone,
  ShoppingCart, Users, Utensils, Home, BookOpen, CircleDollarSign, HeartPulse, Laptop,
  Wand2, Zap, Trophy, AlertTriangle, Image, FileText, Link, RefreshCw,
} from 'lucide-react'

const ICONS = {
  check: Check, sparkle: Sparkles, idea: Lightbulb, palette: Palette, celebrate: PartyPopper,
  note: StickyNote, chart: BarChart3, user: User, search: Search, list: List,
  target: Target, rocket: Rocket, building: Building2, calendar: CalendarDays, done: CheckCircle2,
  phone: Smartphone, cart: ShoppingCart, users: Users, food: Utensils, home: Home, book: BookOpen,
  finance: CircleDollarSign, health: HeartPulse, laptop: Laptop, wand: Wand2, energy: Zap,
  trophy: Trophy, warning: AlertTriangle, image: Image, document: FileText, link: Link, refresh: RefreshCw,
} satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>

export type UiIconName = keyof typeof ICONS

export function UiIcon({ name, size = 24, strokeWidth = 1.75, ...props }: { name: UiIconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const Icon = ICONS[name]
  return <Icon width={size} height={size} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
}
