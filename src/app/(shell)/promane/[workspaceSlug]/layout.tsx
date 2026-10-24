import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { redirect } from "next/navigation";
import PromaneShellFrame from "@/components/promane/PromaneShellFrame";

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
  return <PromaneShellFrame workspaceSlug={workspaceSlug}>{children}</PromaneShellFrame>;
}
