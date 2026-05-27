"use client"
import * as React from "react"
import { cn } from "@/lib/promane/utils"

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) {
  return <>{React.Children.map(children, child => { if (!React.isValidElement(child)) return child; return React.cloneElement(child as any, { open, onOpenChange }) })}</>
}
export function DialogTrigger({ children, render, open, onOpenChange }: { children?: React.ReactNode; render?: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return <div onClick={() => onOpenChange?.(!open)}>{render || children}</div>
}
export function DialogContent({ children, className, open, onOpenChange }: { children: React.ReactNode; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} /><div className={cn("relative z-50 w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl", className)}>{children}</div></div>
}
export function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="mb-4">{children}</div> }
export function DialogTitle({ children }: { children: React.ReactNode }) { return <h2 className="text-lg font-black text-gray-900">{children}</h2> }
