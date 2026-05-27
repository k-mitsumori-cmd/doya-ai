import * as React from "react"
import { cn } from "@/lib/promane/utils"

export function Badge({ className, variant = "secondary", children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", variant === "default" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800", className)} {...props}>
      {children}
    </span>
  )
}
