// ============================================
// 汎用の製品モック（サービス固有のモックが無いLP用）
// ============================================
// ⚠️ 文字だけのLPにしないための最低限の絵。
//    サービス固有のモック（例: src/app/aio/mocks.tsx）を用意できるなら、
//    そちらの方が伝わる。これは「まだ作っていない」ときの受け皿。
// ⚠️ 絵文字は使わない（Material Symbols のみ）。
import React from 'react'
import { Sym } from './primitives'

export function ServiceFeatureMock({ features }: { features?: string[] }) {
  const rows = (features || []).slice(0, 5)
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sym name="check_circle" size={18} style={{ color: 'var(--lp-accent)' }} />
        <span className="text-sm font-black text-slate-800">できること</span>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((f, i) => (
          <div key={i} className="flex items-start gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
            <span
              className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black text-white"
              style={{ background: 'linear-gradient(135deg,#0066ff,var(--lp-accent))' }}
            >
              {i + 1}
            </span>
            <span className="text-[11px] font-bold leading-relaxed text-slate-700">{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
