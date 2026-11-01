"use client"
import * as React from "react"
import { cn } from "@/lib/promane/utils"

// 見出しの id を DialogContent から DialogTitle へ渡す（aria-labelledby のため）
const DialogTitleIdContext = React.createContext<string | undefined>(undefined)

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) {
  return <>{React.Children.map(children, child => { if (!React.isValidElement(child)) return child; return React.cloneElement(child as any, { open, onOpenChange }) })}</>
}
export function DialogTrigger({ children, render, open, onOpenChange }: { children?: React.ReactNode; render?: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return <div onClick={() => onOpenChange?.(!open)}>{render || children}</div>
}
export function DialogContent({ children, className, open, onOpenChange }: { children: React.ReactNode; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const titleId = React.useId()
  // Esc で閉じる（共通の確認ダイアログが開いている間は、そちらが Esc を受ける）
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return
      onOpenChange?.(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("relative z-50 w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl", className)}>
        <DialogTitleIdContext.Provider value={titleId}>{children}</DialogTitleIdContext.Provider>
      </div>
    </div>
  )
}
export function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="mb-4">{children}</div> }
export function DialogTitle({ children }: { children: React.ReactNode }) {
  const id = React.useContext(DialogTitleIdContext)
  return <h2 id={id} className="text-lg font-black text-gray-900">{children}</h2>
}
