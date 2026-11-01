import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => (
  <div data-asset-shot={shot} className="bg-slate-50/70 p-4 text-slate-700">{children}</div>
)

export function SeoBriefMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-[10px] font-black text-blue-600">記事の条件</p><p className="mt-2 text-sm font-black text-slate-900">BtoB マーケティング AI活用</p><div className="mt-3 grid grid-cols-2 gap-2"><span className="rounded-lg bg-slate-50 p-2 text-[10px] font-bold">読者: マーケ責任者</span><span className="rounded-lg bg-slate-50 p-2 text-[10px] font-bold">目的: 比較検討</span></div><div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500"><Sym name="link" size={14} />参考URL 3件を要点化</div></div></Box>
}

export function SeoOutlineMock() {
  const rows = ['AI活用で変わる業務', '導入前に決めること', 'ツール選定の比較軸', '小さく始める手順']
  return <Box shot="process"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black text-slate-900">検索意図から構成を作成中</p><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-600">4 / 4</span></div><div className="mt-3 space-y-2">{rows.map((r,i)=><div key={r} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2"><span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-[9px] font-black text-white">{i+1}</span><span className="text-[10px] font-bold">{r}</span></div>)}</div></div></Box>
}

export function SeoAuditMock() {
  const rows = [['主張の整合性','確認済み'],['参考情報との重複','問題なし'],['根拠が薄い箇所','2件を修正'],['リンク切れ','0件']]
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black text-slate-900">公開前チェック</p><div className="mt-3 space-y-2">{rows.map(([k,v])=><div key={k} className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-bold last:border-0"><span className="flex items-center gap-2"><Sym name="check_circle" size={14} className="text-emerald-500" />{k}</span><span className="text-slate-500">{v}</span></div>)}</div></div></Box>
}
