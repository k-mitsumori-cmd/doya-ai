import type React from 'react'

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number
  hot?: boolean
}

export interface SidebarTheme {
  bgGradient: string
  navText: string
  navTextIcon: string
  sectionText: string
  toggleText: string
  toggleHover: string
  brandingText: string
  profileBg: string
  avatarBg: string
  loginText: string
  loginHover: string
  aiBubbleBg: string
  zapColor: string
}

export interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}
