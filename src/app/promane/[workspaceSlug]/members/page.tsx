import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MemberList } from "@/components/promane/member-list";
import Image from "next/image";

async function safeMembers(workspaceId: string) {
  try {
    const [members, totals] = await Promise.all([
      prisma.promaneMember.findMany({
        where: { workspaceId },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.promaneTimeEntry.groupBy({
        by: ['memberId'],
        where: { member: { workspaceId } },
        _sum: { duration: true },
      }),
    ]);
    const totalByMember = new Map(totals.map((row) => [row.memberId, row._sum.duration ?? 0]));
    return members.map((member) => ({ ...member, totalMinutes: totalByMember.get(member.id) ?? 0 }));
  } catch (e) {
    console.error('[members] fetch failed');
    return null;
  }
}

export default async function MembersPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane");

  const myMember = workspace.members[0];
  const canInvite = !!myMember && ['owner', 'admin'].includes(myMember.role);

  const members = await safeMembers(workspace.id);
  if (!members) {
    return (
      <div role="alert" className="p-8 text-rose-700">
        メンバー情報を読み込めませんでした。時間をおいてページを再読み込みしてください。
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/thumbsup.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div className="flex-1">
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">メンバー</h1>
          <p className="text-[15px] text-gray-400 font-bold">チームの仲間たち 👥 {members.length}人</p>
        </div>
      </div>
      <MemberList
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        canInvite={canInvite}
        myMemberId={myMember?.id}
        members={members.map((m) => ({
          id: m.id, displayName: m.displayName, role: m.role, email: m.user.email,
          hourlyRate: m.hourlyRate,
          totalMinutes: m.totalMinutes,
        }))}
      />
    </div>
  );
}
