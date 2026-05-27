import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/promane/project-form";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

  const clients = await prisma.promaneClient.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">新規プロジェクト作成</h1>
      <ProjectForm workspaceSlug={workspaceSlug} clients={clients} />
    </div>
  );
}
