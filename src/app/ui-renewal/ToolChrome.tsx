'use client'

// どのツールでも同じ位置・同じ見た目で出す枠（見出し・残り回数・工程バー）
import type { CSSProperties } from 'react'
import { Check, Info } from 'lucide-react'
import s from './renewal.module.css'
import { mascotOf } from './data'
import { getServiceById } from '@/lib/services'

export function ToolHeader({ serviceId, stageLabel, note }: { serviceId: string; stageLabel: string; note: string }) {
  const svc = getServiceById(serviceId)
  return (
    <header className={s.toolHead}>
      <div className={s.toolTitle}>
        <span className={s.toolMascot}>
          <img src={mascotOf(serviceId)} alt="" />
        </span>
        <div>
          <p className={s.crumb}>
            {stageLabel} <span>/</span> {svc?.name}
          </p>
          <h1 className={s.toolName}>{svc?.description}</h1>
        </div>
      </div>
      <p className={s.toolNote}>
        <Info size={14} strokeWidth={2} />
        {note}
      </p>
    </header>
  )
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className={s.stepper} style={{ '--p': current / (steps.length - 1) } as CSSProperties}>
      <span className={s.stepperRail} aria-hidden="true">
        <span />
      </span>
      {steps.map((label, i) => (
        <li key={label} data-state={i < current ? 'done' : i === current ? 'now' : 'wait'}>
          <span className={s.stepperDot}>{i < current ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
          <span className={s.stepperLabel}>{label}</span>
        </li>
      ))}
    </ol>
  )
}
