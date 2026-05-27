"use client"
import * as React from "react"
import { cn } from "@/lib/promane/utils"

export function Select({ value, onValueChange, name, defaultValue, children }: { value?: string; onValueChange?: (v: string) => void; name?: string; defaultValue?: string; children: React.ReactNode }) {
  const [val, setVal] = React.useState(value ?? defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (value !== undefined) setVal(value) }, [value])
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler)
  }, [])
  const items: { value: string; label: string }[] = []
  const findItems = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (React.isValidElement(child) && child.props.value !== undefined) items.push({ value: child.props.value, label: String(child.props.children || child.props.value) })
      if (React.isValidElement(child) && child.props.children) findItems(child.props.children)
    })
  }
  findItems(children)
  const selected = items.find(i => i.value === val)
  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={val} />}
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && (child.type as any)?.displayName === "SelectTrigger") return React.cloneElement(child as any, { onClick: () => setOpen(!open), children: selected ? <span className="truncate">{selected.label}</span> : (child.props as any).children })
        if (React.isValidElement(child) && (child.type as any)?.displayName === "SelectContent") return open ? <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white py-1 shadow-lg max-h-60 overflow-auto">{React.Children.map((child.props as any).children, (item: any) => { if (!React.isValidElement(item)) return item; return <button type="button" key={item.props.value} className={cn("flex w-full items-center px-3 py-2 text-sm font-medium hover:bg-blue-50 transition-colors", val === item.props.value && "bg-blue-50 text-blue-700 font-bold")} onClick={() => { setVal(item.props.value); onValueChange?.(item.props.value); setOpen(false) }}>{item.props.children}</button> })}</div> : null
        return null
      })}
    </div>
  )
}
export function SelectTrigger({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) { return <button type="button" onClick={onClick} className={cn("flex h-10 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium", className)}>{children}<svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button> }
SelectTrigger.displayName = "SelectTrigger"
export function SelectContent({ children }: { children: React.ReactNode }) { return <>{children}</> }
SelectContent.displayName = "SelectContent"
export function SelectValue({ placeholder }: { placeholder?: string }) { return <span className="text-gray-400">{placeholder}</span> }
export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) { return <div data-value={value}>{children}</div> }
