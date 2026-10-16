'use client'

import { useState, type CSSProperties } from 'react'
import { ArrowRight, X } from 'lucide-react'
import s from './renewal.module.css'
import { SplitText, useReveal } from './motion'
import { STAGES, mascotOf, stageServices, type StageId } from './data'

const HUB_IMAGE = '/ui-renewal/workmap-hub.webp'
const VB = 560
const C = VB / 2
const R = 196
// 左上→右上→右下→左下（時計回り＝仕事の流れ）
const ANGLE: Record<StageId, number> = { attract: -135, sell: -45, hire: 45, run: 135 }
const pos = (deg: number, r = R) => {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

export function MapScreen({ onOpen }: { onOpen: (serviceId: string) => void }) {
  const root = useReveal<HTMLDivElement>()
  const [mode, setMode] = useState<'flow' | 'role'>('flow')
  const [active, setActive] = useState<StageId | null>('attract')
  const stage = STAGES.find((st) => st.id === active) ?? null
  const services = stage ? stageServices(stage) : []
  const p = active ? pos(ANGLE[active]) : null

  return (
    <div ref={root} className={s.screen}>
      <header className={s.sectionHead}>
        <div>
          <p className={s.eyebrow} data-reveal>
            <span className={s.eyebrowNo}>02</span>
            <span>WORK MAP</span>
          </p>
          <h1 className={s.display}>
            <SplitText text="業務マップ" />
          </h1>
          <p className={s.displaySub} data-reveal style={{ '--d': '.3s' } as CSSProperties}>
            会社の仕事の流れから、使うAIを選ぶ。
          </p>
        </div>
        <div className={s.sectionAside} data-reveal style={{ '--d': '.2s' } as CSSProperties}>
          <p>
            18のAIを、会社の仕事の4つの段階に並べました。点に触れると、その段階で使えるAIが開きます。
          </p>
          <div className={s.toggle} role="tablist" aria-label="並べ方">
            <button type="button" role="tab" aria-selected={mode === 'flow'} onClick={() => setMode('flow')}>
              仕事の流れ<small>FLOW</small>
            </button>
            <button type="button" role="tab" aria-selected={mode === 'role'} onClick={() => setMode('role')}>
              担当者<small>ROLE</small>
            </button>
            <span className={s.toggleThumb} data-pos={mode} aria-hidden="true" />
          </div>
        </div>
      </header>

      <section className={s.mapFig} data-reveal data-spot>
        {/* 図の四隅の十字（Vercel の罫線表現） */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <i key={c} className={s.cross} data-c={c} aria-hidden="true" />
        ))}
        <div className={s.figMeta}>
          <span>FIG. 01</span>
          <em>Doya AI Workflow</em>
        </div>

        <div className={s.mapStage}>
          <svg viewBox={`0 0 ${VB} ${VB}`} className={s.mapSvg} aria-hidden="true">
            <circle cx={C} cy={C} r={R + 62} className={s.orbitOuter} />
            <circle cx={C} cy={C} r={R} className={s.orbitFlow} />
            <circle cx={C} cy={C} r={R - 70} className={s.orbitInner} />
            {[-90, 0, 90, 180].map((d) => {
              const a = pos(d, R + 78)
              const b = pos(d, R + 92)
              return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={s.tick} />
            })}
            {/* 段階ごとのサービスを、外周の小さな点として散らす */}
            {STAGES.map((st) =>
              st.serviceIds.map((id, i) => {
                const spread = 34
                const d = ANGLE[st.id] - spread / 2 + (spread / Math.max(1, st.serviceIds.length - 1)) * i
                const q = pos(st.serviceIds.length === 1 ? ANGLE[st.id] : d, R + 44)
                return (
                  <circle
                    key={id}
                    cx={q.x}
                    cy={q.y}
                    r={active === st.id ? 5 : 3.5}
                    fill={st.color}
                    className={s.sat}
                    style={{ '--i': i, opacity: active && active !== st.id ? 0.25 : 1 } as CSSProperties}
                  />
                )
              }),
            )}
            {p && (
              <g key={active} className={s.leader}>
                <line x1={p.x} y1={p.y} x2={p.x < C ? 0 : VB + 70} y2={p.y} stroke={stage!.color} />
              </g>
            )}
          </svg>

          <div className={s.hub}>
            <img
              src={HUB_IMAGE}
              alt="4つの仕事を分担するSaaSクマのチーム"
              onError={(e) => {
                e.currentTarget.src = '/character/hello-512.webp'
              }}
            />
          </div>

          {STAGES.map((st) => {
            const q = pos(ANGLE[st.id])
            const on = active === st.id
            return (
              <button
                key={st.id}
                type="button"
                className={`${s.hot} ${on ? s.hotOn : ''}`}
                style={{ left: `${(q.x / VB) * 100}%`, top: `${(q.y / VB) * 100}%`, '--c': st.color } as CSSProperties}
                onClick={() => setActive(on ? null : st.id)}
                aria-pressed={on}
              >
                <span className={s.hotDot} />
                <span className={s.hotLabel} data-side={q.x < C ? 'left' : 'right'}>
                  <small>{st.no}</small>
                  {mode === 'flow' ? st.label : st.role}
                </span>
              </button>
            )
          })}
        </div>

        <aside className={s.mapPanel} aria-live="polite">
          {stage ? (
            <div key={stage.id} className={s.panelIn} style={{ '--c': stage.color } as CSSProperties}>
              <div className={s.panelHead}>
                <span className={s.panelEn}>{stage.en}</span>
                <span className={s.panelCount}>{services.length} TOOLS</span>
                <button type="button" className={s.close} onClick={() => setActive(null)} aria-label="閉じる">
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <h2 className={s.panelTitle}>{mode === 'flow' ? stage.label : stage.role}</h2>
              <p className={s.panelLead}>{stage.lead}</p>
              <ul className={s.panelList}>
                {services.map((svc, i) => (
                  <li key={svc.id} style={{ '--i': i } as CSSProperties}>
                    <button type="button" onClick={() => onOpen(svc.id)}>
                      <span className={s.panelThumb}>
                        <img src={mascotOf(svc.id)} alt="" loading="lazy" />
                      </span>
                      <span className={s.panelText}>
                        <strong>{svc.name}</strong>
                        <span>{svc.description}</span>
                      </span>
                      <ArrowRight size={16} strokeWidth={2} className={s.panelArw} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={s.panelEmpty}>
              <p>4つの点のどれかに触れてください。</p>
            </div>
          )}
        </aside>
      </section>

      <section className={s.flowSteps}>
        <p className={s.eyebrow} data-reveal>
          <span className={s.eyebrowNo}>03</span>
          <span>HOW IT CONNECTS</span>
        </p>
        <h2 className={s.h2} data-reveal>
          1つのアカウントで、仕事が次の段階へ流れていく。
        </h2>
        <ol className={s.stepRow}>
          {STAGES.map((st, i) => (
            <li key={st.id} data-reveal style={{ '--d': `${i * 0.12}s`, '--c': st.color } as CSSProperties}>
              <span className={s.stepNo}>{st.no}</span>
              <span className={s.stepRule} />
              <strong>{st.label}</strong>
              <p>{st.lead}</p>
              <span className={s.stepTools}>{st.serviceIds.length}つのAI</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
