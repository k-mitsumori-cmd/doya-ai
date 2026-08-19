import { Sym } from '@/components/lp'

const Box = ({ children, shot }: { children: React.ReactNode; shot: string }) => <div data-asset-shot={shot} className="bg-slate-50/70 p-4">{children}</div>

export function InterviewUploadMock() {
  return <Box shot="input"><div className="rounded-xl border border-dashed border-orange-300 bg-white p-6 text-center shadow-sm"><Sym name="upload_file" size={28} className="mx-auto text-orange-500" /><p className="mt-2 text-xs font-black text-slate-900">取材音声をアップロード</p><p className="mt-1 text-[10px] font-bold text-slate-400">MP3・M4A・MP4 / 長時間ファイル対応</p><div className="mx-auto mt-4 h-2 max-w-48 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-4/5 rounded-full bg-orange-500" /></div></div></Box>
}

export function InterviewTranscriptMock() {
  const lines=[['聞き手','導入前は何が一番の課題でしたか。'],['話し手','問い合わせ後の一次対応に時間がかかっていました。'],['聞き手','運用はどのように変わりましたか。']]
  return <Box shot="process"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black">話者を分けて文字起こし</p><span className="text-[9px] font-black text-orange-600">処理中</span></div><div className="mt-3 space-y-2">{lines.map(([who,t],i)=><div key={i} className="flex gap-2"><span className={`h-6 w-6 shrink-0 rounded-full ${i%2?'bg-sky-100':'bg-orange-100'}`} /><div><p className="text-[9px] font-black text-slate-400">{who}</p><p className="text-[10px] font-bold text-slate-700">{t}</p></div></div>)}</div></div></Box>
}

export function InterviewArticleMock() {
  return <Box shot="output"><div className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black text-slate-900">導入事例ドラフト</p><span className="rounded bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-600">Q&amp;A形式</span></div><p className="mt-3 text-sm font-black text-slate-900">一次対応を整え、顧客との対話に集中できる体制へ</p><div className="mt-3 space-y-2 text-[10px] font-bold leading-relaxed text-slate-500"><p><b className="text-slate-700">Q.</b> 導入前の課題を教えてください。</p><p><b className="text-slate-700">A.</b> 問い合わせの整理に時間がかかり、提案準備が後回しになっていました。</p></div></div></Box>
}
