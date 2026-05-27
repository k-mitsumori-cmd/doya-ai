import { requirePromaneAuth, getWorkspaceBySlug, getCurrentMember } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TimesheetView } from "@/components/promane/timesheet-view";
import Image from "next/image";

export default async function TimesheetPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");
  const member = await getCurrentMember(workspace.id, session.user!.id!);
  if (!member) redirect("/login");

  const timeEntries = await prisma.promaneTimeEntry.findMany({
    where: { memberId: member.id },
    include: { task: { include: { project: { select: { name: true } } } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId: workspace.id },
    include: { tasks: { select: { id: true, title: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/focus.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">タイムシート</h1>
          <p className="text-[15px] text-gray-400 font-bold">今日の作業を記録しよう ⏱</p>
        </div>
      </div>
      <TimesheetView
        workspaceSlug={workspaceSlug}
        memberId={member.id}
        entries={timeEntries.map((te) => ({
          id: te.id, taskId: te.taskId, duration: te.duration, date: te.date.toISOString(),
          note: te.note, taskTitle: te.task?.title || null, projectName: te.task?.project?.name || null,
        }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks }))}
      />
    </div>
  );
}
