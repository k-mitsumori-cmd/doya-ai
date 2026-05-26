'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

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
}

function DepartmentNode({ dept, level = 0 }: { dept: OrgDepartment; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2)
  const headInitials = dept.head
    ? `${dept.head.lastName?.[0] || ''}${dept.head.firstName?.[0] || ''}`
    : ''

  return (
    <div className="flex flex-col items-center">
      {/* Department Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl border-2 border-sky-200 shadow-sm min-w-[200px] overflow-hidden"
      >
        {/* Department Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-5 text-left hover:bg-sky-50/50 transition-colors"
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
              <p className="font-bold text-slate-900 text-lg">{dept.name}</p>
              {dept.head && (
                <p className="text-base font-bold text-slate-500 truncate">
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
              {dept.members.length}名
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
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100 overflow-hidden"
            >
              <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
                {dept.members.map((member) => {
                  const mi = `${member.lastName?.[0] || ''}${member.firstName?.[0] || ''}`
                  return (
                    <div key={member.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
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
                          <p className="text-xs font-semibold text-slate-400 truncate">{member.position}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Children Departments */}
      {expanded && dept.children.length > 0 && (
        <div className="mt-4">
          {/* Connector line down */}
          <div className="flex justify-center">
            <div className="w-0.5 h-6 bg-sky-200" />
          </div>

          {/* Horizontal line */}
          {dept.children.length > 1 && (
            <div className="flex justify-center">
              <div className="h-0.5 bg-sky-200" style={{ width: `${Math.min(dept.children.length * 240, 960)}px` }} />
            </div>
          )}

          {/* Child nodes */}
          <div className="flex flex-wrap justify-center gap-6">
            {dept.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Connector line down to child */}
                <div className="w-0.5 h-4 bg-sky-200" />
                <DepartmentNode dept={child} level={level + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrgChartView({ departments, orgName }: OrgChartViewProps) {
  if (departments.length === 0) {
    return (
      <div className="text-center py-16">
        <motion.img
          src="/hr/characters/thinking_考え中.png"
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
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
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
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col items-center min-w-full py-8 px-4">
        {/* Org Name */}
        {orgName && (
          <div className="mb-6">
            <div className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl shadow-lg shadow-sky-500/20">
              <p className="font-black text-2xl">{orgName}</p>
            </div>
            <div className="flex justify-center">
              <div className="w-0.5 h-6 bg-sky-200" />
            </div>
          </div>
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
