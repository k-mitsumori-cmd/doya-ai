import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Image from "next/image";
import { WorkspaceSettingsForm } from "@/components/promane/workspace-settings-form";
import { RepairDataButton } from "@/components/promane/repair-data-button";

export default async function SettingsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane");

  const myMember = workspace.members[0];
  const canEdit = !!myMember && ["owner", "admin"].includes(myMember.role);

  const memberCount = await prisma.promaneMember.count({ where: { workspaceId: workspace.id } });
  const projectCount = await prisma.promaneProject.count({ where: { workspaceId: workspace.id } });
  const clientCount = await prisma.promaneClient.count({ where: { workspaceId: workspace.id } });

  const stats = [
    { emoji: "👥", label: "メンバー数", value: `${memberCount} 人`, bg: "from-blue-100 to-indigo-100" },
    { emoji: "📁", label: "プロジェクト数", value: `${projectCount} 件`, bg: "from-violet-100 to-purple-100" },
    { emoji: "🏢", label: "顧客数", value: `${clientCount} 社`, bg: "from-amber-100 to-orange-100" },
  ];

  return (
    <div className="p-8 max-w-[800px]">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/point.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">設定</h1>
          <p className="text-[15px] text-gray-400 font-bold">ワークスペースの設定 ⚙️</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-8 mb-6 animate-slide-up stagger-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-black text-white shadow-md">
            {workspace.name.charAt(0)}
          </div>
          <div>
            <p className="text-[20px] font-black text-gray-900">{workspace.name}</p>
            <p className="text-[14px] font-bold text-gray-400">/{workspace.slug}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.bg} p-5 text-center transition-all hover:scale-105 stagger-${i + 1}`}>
              <span className="text-3xl">{stat.emoji}</span>
              <p className="mt-2 text-[13px] font-bold text-gray-500">{stat.label}</p>
              <p className="text-[24px] font-black text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 編集可能フォーム */}
      <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-8 mb-6 animate-slide-up stagger-2">
        <h2 className="text-[18px] font-black text-gray-900 mb-1">🔧 ワークスペース情報</h2>
        <p className="text-[12px] font-bold text-gray-400 mb-5">
          {canEdit ? '名前とスラッグ (URL) を編集できます' : '編集は owner/admin のみ可能です'}
        </p>
        <WorkspaceSettingsForm
          workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
          canEdit={canEdit}
          currentSlug={workspaceSlug}
        />

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-[12px] font-bold text-gray-400">
          <span>作成日</span>
          <span>{new Date(workspace.createdAt).toLocaleDateString("ja-JP")}</span>
        </div>
      </div>

      {/* データ修復セクション (owner/admin限定) */}
      {canEdit && (
        <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-6 animate-slide-up stagger-3">
          <div className="flex items-start gap-4">
            <Image src="/character/working.png" alt="" width={56} height={56} unoptimized className="flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-[16px] font-black text-amber-900 mb-1">🔧 データ修復ツール</h3>
              <p className="text-[12px] text-amber-800 font-bold leading-relaxed mb-3">
                過去に登録された負額の経費・契約金額・時給、逆転日付タスクを<br />
                一括で正常な値に修復します（負値→0、終了日逆転→null）。
              </p>
              <RepairDataButton workspaceSlug={workspaceSlug} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
