import PromanePageIntro from '@/components/promane/PromanePageIntro';
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MemberList } from "@/components/promane/member-list";

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
      <PromanePageIntro
        className="flex items-center gap-5 mb-8 animate-slide-up"
        image="/character/thumbsup.png"
        imageSize={80}
        title="メンバー"
        titleClassName="text-[28px] font-black tracking-tight text-gray-900"
        legacyLead={<>チームの仲間たち 👥 {members.length}人</>}
        legacyLeadClassName="text-[15px] text-gray-400 font-bold" legacyTextClassName="flex-1"
        lead="メンバーの招待と、役割・時給を管理します。"
      />
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
