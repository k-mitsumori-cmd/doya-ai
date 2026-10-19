import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function PersonaBriefMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black text-slate-900">商材と届けたい相手</p><div className="mt-3 space-y-2"><div className="rounded-lg bg-slate-50 p-2 text-[10px] font-bold">商材: 法人向け業務支援SaaS</div><div className="rounded-lg bg-slate-50 p-2 text-[10px] font-bold">業界: IT・Webサービス</div><div className="rounded-lg bg-slate-50 p-2 text-[10px] font-bold">想定役割: 部門責任者</div></div><button className="mt-3 w-full rounded-lg bg-violet-600 py-2 text-[10px] font-black text-white">ペルソナを組み立てる</button></div></Box>
}

export function PersonaProfileMock() {
  return <Box shot="process"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-violet-100 text-sm font-black text-violet-700">佐藤</div><div><p className="text-sm font-black text-slate-900">佐藤 美咲</p><p className="text-[10px] font-bold text-slate-400">事業会社 マーケティング責任者</p></div></div><div className="mt-3 grid grid-cols-2 gap-2">{[['目標','少人数で施策を増やす'],['悩み','制作指示が属人化'],['情報源','検索・業界メディア'],['判断軸','導入負荷と再現性']].map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] font-black text-violet-600">{k}</p><p className="mt-1 text-[10px] font-bold text-slate-700">{v}</p></div>)}</div></div></Box>
}

export function PersonaPlanMock() {
  const rows=[['訴求','作業時間ではなく判断時間を増やす'],['導線','比較記事から無料体験へ'],['懸念','既存業務への組み込みやすさ'],['検証','初回作成までの完了率']]
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="flex items-center gap-2 text-xs font-black"><Sym name="description" size={16} className="text-violet-600" />施策に使う要点</p><div className="mt-3 space-y-2">{rows.map(([k,v])=><div key={k} className="border-l-2 border-violet-300 pl-2"><p className="text-[9px] font-black text-violet-600">{k}</p><p className="text-[10px] font-bold text-slate-700">{v}</p></div>)}</div></div></Box>
}
