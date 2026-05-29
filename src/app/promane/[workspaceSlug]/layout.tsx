import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { Sidebar } from "@/components/promane/sidebar";
import { FeedbackButton } from "@/components/promane/feedback-button";
import { redirect } from "next/navigation";

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
  if (!workspace) redirect("/login");

  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      <Sidebar workspaceSlug={workspaceSlug} />
      <main className="flex-1 overflow-auto">{children}</main>
      {/* 全ページ常駐: フィードバック→Slack通知 */}
      <FeedbackButton variant="floating" />
    </div>
  );
}
