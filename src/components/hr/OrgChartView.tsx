'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Button, EmptyState } from '@/components/ds'
import styles from './OrgChart.module.css'

interface OrgEmployee {
  id: string
  firstName: string
  lastName: string
  position?: string | null
  photoUrl?: string | null
}

interface OrgDepartment {
  id: string
  name: string
  headId?: string | null
  head?: OrgEmployee | null
  members: OrgEmployee[]
  children: OrgDepartment[]
}

interface OrgChartViewProps {
  departments: OrgDepartment[]
  orgName?: string
  unassignedEmployees?: OrgEmployee[]
}

function DepartmentNode({ dept, level = 0 }: { dept: OrgDepartment; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2)
  const [visibleMembers, setVisibleMembers] = useState(100)
  // 新しい見た目では、動きを減らす設定のときに開閉・出現のアニメーションを止める
  const reduceMotion = useReducedMotion()
  const still = Boolean(reduceMotion)
  const headInitials = dept.head
    ? `${dept.head.lastName?.[0] || ''}${dept.head.firstName?.[0] || ''}`
    : ''

  return (
    <div className="flex flex-col items-center">
      {/* Department Card */}
      {/* 部署のカード。上の段から順に、線が伸びたあとで跳ねて出る（CSS。動きを減らす設定では出さない。2026-10-27） */}
      <div
        className={`${styles.card} bg-white rounded-2xl w-[min(248px,calc(100vw-5rem))] min-w-[200px] overflow-hidden`}
        style={{ '--lv': level } as CSSProperties}
      >
        {/* Department Header */}
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          aria-label={`${dept.name}（${expanded ? '閉じる' : '所属メンバーと下位部署を開く'}）`}
          className="w-full p-4 sm:p-5 text-left hover:bg-sky-50/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue,#0066ff)]"
        >
          <div className="flex items-center gap-3">
            {dept.head?.photoUrl ? (
              <img
                src={dept.head.photoUrl}
                alt={`${dept.head.lastName} ${dept.head.firstName}`}
                className="w-10 h-10 rounded-full object-cover border-2 border-sky-100"
              />
            ) : dept.head ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold border-2 border-sky-100">
                {headInitials}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400 text-lg">apartment</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-slate-900 ${dept.name.length >= 8 ? 'text-[14px]' : 'text-[16px]'} leading-snug [word-break:auto-phrase] [overflow-wrap:anywhere] [text-wrap:balance]`}>{dept.name}</p>
              {dept.head && (
                <p className="text-[14px] font-bold text-slate-600 truncate">
                  {dept.head.lastName} {dept.head.firstName}
                  {dept.head.position && ` (${dept.head.position})`}
                </p>
              )}
            </div>
            <span className={`material-symbols-outlined text-slate-400 text-sm font-bold transition-transform ${expanded ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
              {dept.members.length + (dept.head ? 1 : 0)}名
            </span>
            {dept.children.length > 0 && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                {dept.children.length}部門
              </span>
            )}
          </div>
        </button>

        {/* Members List */}
        <AnimatePresence>
          {expanded && dept.members.length > 0 && (
            <motion.div
              initial={still ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100 overflow-hidden"
            >
              <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
                {dept.members.slice(0, visibleMembers).map((member) => {
                  const mi = `${member.lastName?.[0] || ''}${member.firstName?.[0] || ''}`
                  return (
                    <div key={member.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={`${member.lastName} ${member.firstName}`} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-300 to-blue-400 flex items-center justify-center text-white text-[10px] font-bold">
                          {mi}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">
                          {member.lastName} {member.firstName}
                        </p>
                        {member.position && (
                          <p className="text-xs font-semibold text-slate-500 truncate">{member.position}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                {dept.members.length > visibleMembers && <button type="button" onClick={() => setVisibleMembers(count => count + 100)} className="w-full rounded-lg px-3 py-2 text-sm font-bold text-sky-700 hover:bg-sky-50 min-h-11">さらに{Math.min(100, dept.members.length - visibleMembers)}名を表示</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 下の部署。親から下りる線 → 横の線 → 子へ下りる線 の順に伸びる（線は子ごとに半分ずつ持つので、数が変わってもずれない） */}
      {expanded && dept.children.length > 0 && (
        <ul className={styles.children} style={{ '--lv': level } as CSSProperties}>
          {dept.children.map((child) => (
            <li key={child.id} className={styles.child} style={{ '--lv': level + 1 } as CSSProperties}>
              <span className={styles.drop} aria-hidden />
              <DepartmentNode dept={child} level={level + 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function OrgChartView({ departments, orgName, unassignedEmployees = [] }: OrgChartViewProps) {
  // 組織図が画面より広いときの見せ方（2026-10-27）
  // - 少しだけ広い（70% まで縮めれば入る）ときは、全体を縮めて横に送らずに見られるようにする
  // - それでも入らないときは縮めず、はじめに一番上（会社名）が真ん中に来る位置まで横に送る
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const fit = () => {
      const el = scrollRef.current, inner = innerRef.current
      if (!el || !inner) return
      const cur = Number(getComputedStyle(inner).zoom) || 1
      const natural = inner.getBoundingClientRect().width / cur
      const ratio = el.clientWidth / natural
      const next = ratio >= 1 ? 1 : ratio >= 0.7 ? Math.floor(ratio * 100) / 100 : 1
      setZoom((z) => (Math.abs(z - next) < 0.01 ? z : next))
      if (next === 1 && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [departments.length])
  if (departments.length === 0 && unassignedEmployees.length === 0) {
    // 新しい見た目: 空の状態は絵＋次にやること1つ
    return (
      <EmptyState
        art="/hr/empty-members.webp"
        title="組織図を表示するには、まず部署を作成してください"
        description="部署と従業員を登録すると、組織図が自動的にできあがります。"
        action={<Button href="/hr/settings" icon="Settings">設定画面で部署を追加</Button>}
      />
    )
  }
  if (departments.length === 0 && unassignedEmployees.length === 0) {
    return (
      <div className="text-center py-16">
        <motion.img
          src="/hr/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png"
          alt="白くまキャラクター"
          className="w-40 mx-auto mb-4"
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        />
        <h3 className="text-xl font-black text-slate-900 mb-2">組織図を表示するには、まず部署を作成してください</h3>
        <p className="text-base text-slate-500 mb-6">部署と従業員を登録すると、組織図が自動的に生成されます。</p>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
          <Link
            href="/hr/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            設定画面で部署を追加
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div ref={innerRef} className="inline-flex flex-col items-center min-w-full py-8 px-4" style={zoom < 1 ? { zoom } : undefined}>
        {/* Org Name */}
        {orgName && (
          <div className="mb-6">
            <div className={`${styles.root} max-w-[calc(100vw-5rem)] px-6 py-3 text-white rounded-2xl`}>
              <p className="font-black text-xl sm:text-2xl text-center break-words [text-wrap:balance]">{orgName}</p>
            </div>
            <div className="flex justify-center">
              <div className={styles.rootDrop} />
            </div>
          </div>
        )}

        {unassignedEmployees.length > 0 && (
          <section aria-label="有効な部署に所属していない従業員" className="mb-8">
            <p className="mb-3 text-center text-sm text-slate-600">部署未所属、または無効な部署に所属している従業員です。従業員情報で所属部署をご確認ください。</p>
            <DepartmentNode dept={{ id: '__unassigned_display__', name: '所属部署を確認', members: unassignedEmployees, children: [] }} />
          </section>
        )}

        {/* Department Tree */}
        <div className="flex flex-wrap justify-center gap-8">
          {departments.map((dept) => (
            <DepartmentNode key={dept.id} dept={dept} />
          ))}
        </div>
      </div>
    </div>
  )
}
