'use client'

import { useState } from 'react'

export function useSidebarState({
  controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: {
  controlledIsCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)

  const isCollapsed = forceExpanded ? false : (controlledIsCollapsed ?? internalIsCollapsed)
  const showLabel = isMobile || !isCollapsed

  const toggle = () => {
    const next = !isCollapsed
    if (onToggle) onToggle(next)
    else setInternalIsCollapsed(next)
  }

  const expand = () => {
    if (onToggle) onToggle(false)
    else setInternalIsCollapsed(false)
  }

  return { isCollapsed, showLabel, toggle, expand }
}
