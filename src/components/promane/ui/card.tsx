import * as React from "react"
import { cn } from "@/lib/promane/utils"

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-2xl bg-white ring-1 ring-gray-200 shadow-sm", className)} {...props}>{children}</div> }
export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) { return <div className={cn("p-6 pb-0", className)}>{children}</div> }
export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) { return <h3 className={cn("text-lg font-bold", className)}>{children}</h3> }
export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) { return <div className={cn("p-6", className)}>{children}</div> }
