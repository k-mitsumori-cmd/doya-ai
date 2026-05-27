import * as React from "react"
import { cn } from "@/lib/promane/utils"

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-gray-200", className)}>
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
