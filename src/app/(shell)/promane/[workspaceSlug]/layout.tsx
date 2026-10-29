import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { redirect } from "next/navigation";
import PromaneShellFrame from "@/components/promane/PromaneShellFrame";
import { canWritePromaneWorkspace } from '@/lib/promane/ui-permissions';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane"); // ワークスペースが無い/権限が無い時は入口へ（/login は存在しない）

  // ToolFrame だけで包む（フィードバック・通知は枠の側で出す）
  return <PromaneShellFrame workspaceSlug={workspaceSlug}>
    {!canWritePromaneWorkspace(workspace.members[0]?.role) && (
      <p role="status" className="mx-8 mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        このワークスペースは閲覧のみです。内容の追加・変更・削除はできません。
      </p>
    )}
    {children}
  </PromaneShellFrame>;
}
