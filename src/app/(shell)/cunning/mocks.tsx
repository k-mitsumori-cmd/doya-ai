import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function CunningKnowledgeMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black">会議で使う資料</p><div className="mt-3 space-y-2">{['サービス概要.pdf','料金・プラン.pdf','導入手順.pdf'].map((r,i)=><div key={r} className="flex items-center gap-2 rounded-lg border p-2 text-[10px] font-bold"><Sym name="description" size={14} className="text-cyan-600" /><span className="flex-1">{r}</span><span className="text-emerald-600">登録済み</span></div>)}</div></div></Box>
}

export function CunningLiveMock() {
  return <Box shot="process"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black">会議の質問を検出</p><span className="flex items-center gap-1 text-[9px] font-black text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />接続中</span></div><div className="mt-3 rounded-lg bg-slate-900 p-3 text-[10px] font-bold leading-relaxed text-white">「導入後、最初に必要な設定はどこまでですか？」</div><p className="mt-2 text-[9px] font-bold text-slate-400">質問として検出し、登録資料を検索しています</p></div></Box>
}

export function CunningAnswerMock() {
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-[9px] font-black text-cyan-600">まず伝える要点</p><p className="mt-1 text-sm font-black text-slate-900">初期設定は担当者と利用目的の登録から始められます。</p><div className="mt-3 rounded-lg bg-cyan-50 p-3"><p className="text-[9px] font-black text-cyan-700">話すための補足</p><p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-600">既存データの取り込みがある場合も、段階的に設定できます。まず小さなチームから開始できます。</p></div><p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-slate-400"><Sym name="menu_book" size={12} />根拠: 導入手順.pdf</p></div></Box>
}
