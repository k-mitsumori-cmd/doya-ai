"use client"
import * as React from "react"
import { cn } from "@/lib/promane/utils"

const TabsContext = React.createContext<{ value: string; onChange: (v: string) => void }>({ value: "", onChange: () => {} })

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const [value, setValue] = React.useState(defaultValue)
  return <TabsContext.Provider value={{ value, onChange: setValue }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1", className)}>{children}</div>
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext)
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={cn("rounded-lg px-4 py-2 text-sm font-bold transition-all", ctx.value === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700", className)}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
