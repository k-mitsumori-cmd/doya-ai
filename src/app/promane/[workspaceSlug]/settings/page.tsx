import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function SettingsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

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

      <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-8 animate-slide-up stagger-2">
        <h2 className="text-[18px] font-black text-gray-900 mb-4">🔧 ワークスペース情報</h2>
        <div className="space-y-4">
          {[
            { label: "ワークスペース名", value: workspace.name },
            { label: "スラッグ", value: workspace.slug },
            { label: "作成日", value: new Date(workspace.createdAt).toLocaleDateString("ja-JP") },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <span className="text-[15px] font-bold text-gray-500">{item.label}</span>
              <span className="text-[16px] font-black text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center animate-slide-up stagger-3">
        <Image src="/character/ramen.png" alt="" width={80} height={80} className="mx-auto animate-float opacity-60" unoptimized />
        <p className="mt-2 text-[13px] font-bold text-gray-300">設定の変更は今後アップデート予定です</p>
      </div>
    </div>
  );
}
