import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function DoyalistFilterMock() {
  return <Box shot="input"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-black">企業リストの条件</p><div className="mt-3 grid grid-cols-2 gap-2">{[['業種','情報サービス'],['地域','東京都'],['従業員規模','50〜300名'],['キーワード','採用強化']].map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] font-black text-emerald-600">{k}</p><p className="text-[10px] font-bold">{v}</p></div>)}</div><button className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-[10px] font-black text-white">条件から候補を探す</button></div></Box>
}

export function DoyalistTableMock() {
  const rows=[['サンプルテック株式会社','情報サービス','東京都'],['青空デジタル株式会社','Web制作','神奈川県'],['みらい業務研究所','コンサルティング','東京都']]
  return <Box shot="process"><div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex items-center justify-between p-3"><p className="text-xs font-black">候補企業</p><span className="text-[9px] font-black text-emerald-600">法人情報を確認済み</span></div>{rows.map((r,i)=><div key={i} className="grid grid-cols-[1.5fr_1fr_.8fr] gap-2 border-t p-2.5 text-[9px] font-bold"><span className="text-slate-800">{r[0]}</span><span className="text-slate-500">{r[1]}</span><span className="text-slate-500">{r[2]}</span></div>)}</div></Box>
}

export function DoyalistMessageMock() {
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-black"><Sym name="mail" size={15} className="text-emerald-600" />企業別の営業文面</p><span className="rounded bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">メール</span></div><p className="mt-3 rounded-lg bg-slate-50 p-3 text-[10px] font-bold leading-relaxed text-slate-600">貴社の採用強化に関する取り組みを拝見し、候補者対応の初動を整える方法をご案内したくご連絡しました。</p><div className="mt-2 flex gap-2 text-[9px] font-bold text-slate-400"><span>フォーム文</span><span>電話スクリプト</span><span>CSV出力</span></div></div></Box>
}
