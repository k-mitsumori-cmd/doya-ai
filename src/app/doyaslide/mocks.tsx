import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function DoyaSlideBriefMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black">新しい資料</p><div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-[9px] font-black text-blue-600">テーマ</p><p className="mt-1 text-[11px] font-bold">新規事業の社内提案資料</p></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[9px] font-black"><span className="rounded-lg border border-blue-300 bg-blue-50 p-2 text-blue-700">提案書</span><span className="rounded-lg border p-2 text-slate-500">営業資料</span><span className="rounded-lg border p-2 text-slate-500">SNS</span></div></div></Box>
}

export function DoyaSlideStructureMock() {
  const rows=['課題の整理','提案の全体像','実行ステップ','検証指標','次のアクション']
  return <Box shot="process"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black">構成を設計中</p><span className="text-[9px] font-black text-blue-600">5ページ</span></div><div className="mt-3 space-y-1.5">{rows.map((r,i)=><div key={r} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"><span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-[9px] font-black text-white">{i+1}</span><span className="text-[10px] font-bold">{r}</span></div>)}</div></div></Box>
}

export function DoyaSlideDeckMock() {
  const cards=[['01','課題'],['02','提案'],['03','実行'],['04','検証']]
  return <Box shot="output"><div className="rounded-xl border bg-white p-3 shadow-sm"><div className="grid grid-cols-2 gap-2">{cards.map(([n,t],i)=><div key={n} className={`aspect-video rounded-lg p-2 text-white ${i%2?'bg-gradient-to-br from-sky-500 to-blue-700':'bg-gradient-to-br from-blue-700 to-slate-900'}`}><p className="text-[8px] font-black opacity-70">{n}</p><p className="mt-2 text-xs font-black">{t}</p><div className="mt-2 h-1 w-10 rounded bg-cyan-300" /></div>)}</div><p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-slate-400"><Sym name="check_circle" size={12} className="text-emerald-500" />同じ配色とレイアウト規則で生成済み</p></div></Box>
}
