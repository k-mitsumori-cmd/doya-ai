import * as React from "react"
import { cn } from "@/lib/promane/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn("flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50", className)} ref={ref} {...props} />
  )
)
Textarea.displayName = "Textarea"
export { Textarea }
