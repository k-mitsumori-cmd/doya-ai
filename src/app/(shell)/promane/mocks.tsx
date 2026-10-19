import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function PromaneProjectMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black">新しい案件</p><div className="mt-3 grid grid-cols-2 gap-2">{[['案件名','新サービスサイト制作'],['売上予定','1,200,000円'],['開始日','8月20日'],['納期','10月31日']].map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] font-black text-blue-600">{k}</p><p className="mt-1 text-[10px] font-bold">{v}</p></div>)}</div></div></Box>
}

export function PromaneBoardMock() {
  const cols=[['未着手',['要件整理','素材確認']],['進行中',['画面設計','原稿作成']],['確認待ち',['トップページ']]]
  return <Box shot="process"><div className="grid grid-cols-3 gap-2">{cols.map(([name,items])=><div key={name as string} className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[9px] font-black text-slate-500">{name as string}</p><div className="mt-2 space-y-1.5">{(items as string[]).map(item=><div key={item} className="rounded-lg border border-slate-100 p-2 text-[9px] font-bold text-slate-700">{item}<div className="mt-2 h-1 rounded bg-blue-100"><div className="h-full w-2/3 rounded bg-blue-500" /></div></div>)}</div></div>)}</div></Box>
}

export function PromaneProfitMock() {
  const rows=[['売上','1,200,000円','text-blue-600'],['人件費','520,000円','text-slate-700'],['その他原価','80,000円','text-slate-700'],['見込み利益','600,000円','text-emerald-600']]
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black">案件の収支</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">利益率 50%</span></div><div className="mt-3 space-y-2">{rows.map(([k,v,c])=><div key={k} className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-bold last:border-0"><span className="text-slate-500">{k}</span><span className={c}>{v}</span></div>)}</div><p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-slate-400"><Sym name="schedule" size={12} />記録した工数から人件費を自動集計</p></div></Box>
}
