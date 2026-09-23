import { Prisma } from '@prisma/client';
import Link from 'next/link';
import { parseTimesheetQuery, readTimesheet } from '@/lib/promane/timesheet-read';
import { requirePromaneAuth } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TimesheetView } from "@/components/promane/timesheet-view";
import Image from "next/image";

export default async function TimesheetPage({ params, searchParams }: { params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ month?: string | string[]; cursor?: string | string[] }> }) {
  const session = await requirePromaneAuth();
  const userId = session.user?.id;
  if (!userId) redirect('/promane');
  const { workspaceSlug } = await params;
  let query: ReturnType<typeof parseTimesheetQuery>;
  try { query = parseTimesheetQuery(await searchParams) }
  catch { return <div role="alert" className="p-8">表示条件を確認できませんでした。<Link className="underline" href={`/promane/${workspaceSlug}/timesheet`}>タイムシートを読み直す</Link></div> }
  let result;
  try { result = await prisma.$transaction(tx => readTimesheet(tx, userId, workspaceSlug, query), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) }
  catch { return <div role="alert" className="p-8">タイムシートを取得できませんでした。<Link className="underline" href={`/promane/${workspaceSlug}/timesheet`}>一覧を読み直す</Link></div> }
  if (!result) redirect('/promane');
  const { entries: timeEntries, projects } = result;
  const nextParams = new URLSearchParams();
  if (query.month) nextParams.set('month', query.month);
  if (result.nextCursor) nextParams.set('cursor', result.nextCursor);

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/focus.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">タイムシート</h1>
          <p className="text-[15px] text-gray-400 font-bold">今日の作業を記録しよう ⏱</p>
        </div>
      </div>
      <form className="flex flex-wrap items-end gap-3 mb-6" method="get" action={`/promane/${workspaceSlug}/timesheet`}>
        <label className="text-sm font-bold">対象月（未指定は全期間）<input className="block border rounded-lg p-2" type="month" name="month" defaultValue={query.month} /></label>
        <button className="border rounded-lg px-4 py-2" type="submit">表示する</button>
        <Link className="underline" href={`/promane/${workspaceSlug}/timesheet`}>全期間を表示</Link>
      </form>
      <TimesheetView
        workspaceSlug={workspaceSlug}
        memberId={result.memberId}
        totalCount={result.totalCount}
        totalMinutes={result.totalMinutes}
        periodLabel={query.month || "全期間"}
        entries={timeEntries.map((te) => ({
          id: te.id, taskId: te.taskId, duration: te.duration, date: te.date.toISOString(),
          note: te.note, taskTitle: te.task?.title || null, projectName: te.project?.name || te.task?.project?.name || null,
        }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks }))}
      />
      <nav aria-label="時間記録のページ送り" className="flex gap-6 mt-6">
        {query.cursor && <Link className="underline" href={`/promane/${workspaceSlug}/timesheet${query.month ? `?month=${query.month}` : ''}`}>対象期間の最新の記録へ</Link>}
        {result.nextCursor && <Link className="underline" href={`/promane/${workspaceSlug}/timesheet?${nextParams}`}>古い記録をさらに50件表示</Link>}
      </nav>
    </div>
  );
}
