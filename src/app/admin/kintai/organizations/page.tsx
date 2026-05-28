'use client'

import { useEffect, useState } from 'react'

export default function AdminKintaiOrgsPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/kintai/organizations')
      .then(r => r.json())
      .then(d => setOrgs(d.organizations || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🏢</span> 組織一覧
        </h1>
        <p className="text-sm text-white/40 mt-1">全{orgs.length}組織</p>
      </div>

      <div className="space-y-4">
        {orgs.map(org => (
          <div key={org.id} className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                  {org.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-white font-bold">{org.name}</p>
                  <p className="text-xs text-white/30">{org.slug} / 作成: {new Date(org.createdAt).toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-white font-bold">{org.activeCount}<span className="text-white/30 text-xs ml-0.5">名</span></p>
                  <p className="text-[10px] text-emerald-400">有効従業員</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">{org.pendingCount}<span className="text-white/30 text-xs ml-0.5">名</span></p>
                  <p className="text-[10px] text-amber-400/60">招待中</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60">{org.departments.length}<span className="text-white/30 text-xs ml-0.5">部署</span></p>
                </div>
                <span className={`material-symbols-outlined text-white/30 transition-transform ${expandedOrg === org.id ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>
            </button>

            {expandedOrg === org.id && (
              <div className="border-t border-white/5 px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/40 mb-2 font-bold">部署</p>
                    <div className="flex flex-wrap gap-2">
                      {org.departments.map((d: any) => (
                        <span key={d.id} className="px-2.5 py-1 bg-white/5 text-white/60 text-xs rounded-lg">{d.name}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-2 font-bold">就業ルール</p>
                    <div className="flex flex-wrap gap-2">
                      {org.workRules.map((r: any) => (
                        <span key={r.id} className="px-2.5 py-1 bg-white/5 text-white/60 text-xs rounded-lg">{r.name} ({r.workStart}-{r.workEnd})</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 mb-2 font-bold">従業員一覧</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-xs">
                        <th className="text-left py-1.5 px-2">氏名</th>
                        <th className="text-left py-1.5 px-2">メール</th>
                        <th className="text-center py-1.5 px-2">雇用</th>
                        <th className="text-center py-1.5 px-2">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.employees.map((emp: any) => (
                        <tr key={emp.id} className="border-t border-white/5">
                          <td className="py-2 px-2 text-white/80">{emp.name}</td>
                          <td className="py-2 px-2 text-white/40 text-xs">{emp.email}</td>
                          <td className="py-2 px-2 text-center text-white/40 text-xs">
                            {emp.employmentType === 'full_time' ? '正社員' : emp.employmentType === 'part_time' ? 'パート' : '契約'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                              {emp.isActive ? '有効' : '無効'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
