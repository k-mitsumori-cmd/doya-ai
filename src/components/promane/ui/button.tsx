import * as React from "react"
import { cn } from "@/lib/promane/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "outline" && "border border-gray-200 bg-white hover:bg-gray-50",
        variant === "ghost" && "hover:bg-gray-100",
        variant === "destructive" && "bg-red-500 text-white hover:bg-red-600",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 px-3 text-xs",
        size === "lg" && "h-12 px-6",
        size === "icon" && "h-10 w-10",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"
export { Button }
