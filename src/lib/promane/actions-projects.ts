"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

/** 数値バリデーション: 0以上の整数を保証 */
function validateAmount(value: number | undefined | null, fieldName: string): number {
  if (value == null || value === 0) return 0;
  if (!Number.isFinite(value)) throw new Error(`${fieldName} は数値で入力してください`);
  if (value < 0) throw new Error(`${fieldName} は 0以上の値を入力してください`);
  if (value > 9_999_999_999) throw new Error(`${fieldName} が大きすぎます`);
  return Math.floor(value);
}

/** 日付バリデーション: startDate <= endDate */
function validateDates(
  startDate?: string | Date | null,
  endDate?: string | Date | null
): { startDate: Date | null; endDate: Date | null } {
  const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
  const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
  if (start && isNaN(start.getTime())) throw new Error("開始日の形式が不正です");
  if (end && isNaN(end.getTime())) throw new Error("終了日の形式が不正です");
  if (start && end && end < start) {
    throw new Error("終了日は開始日以降を指定してください");
  }
  return { startDate: start, endDate: end };
}

export async function createProject(workspaceSlug: string, data: {
  name: string;
  clientId?: string;
  description?: string;
  status?: string;
  billingType?: string;
  contractAmount?: number;
  monthlyAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  startDate?: string;
  endDate?: string;
  tags?: string;
}) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  if (!data.name?.trim()) throw new Error("プロジェクト名は必須です");
  if (data.name.length > 200) throw new Error("プロジェクト名は200文字以内");
  const contractAmount = validateAmount(data.contractAmount, "契約金額");
  const monthlyAmount = data.monthlyAmount != null ? validateAmount(data.monthlyAmount, "月額") : null;
  const hourlyRate = data.hourlyRate != null ? validateAmount(data.hourlyRate, "時給") : null;
  const estimatedHours = data.estimatedHours != null ? validateAmount(data.estimatedHours, "見積工数") : null;
  const { startDate, endDate } = validateDates(data.startDate, data.endDate);

  const project = await prisma.promaneProject.create({
    data: {
      workspaceId: workspace.id,
      name: data.name.trim(),
      clientId: data.clientId || null,
      description: data.description?.slice(0, 5000) || null,
      status: data.status || "draft",
      billingType: data.billingType || "fixed",
      contractAmount,
      monthlyAmount,
      hourlyRate,
      estimatedHours,
      startDate,
      endDate,
      tags: data.tags?.slice(0, 500) || null,
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}`);
  return project;
}

export async function updateProject(workspaceSlug: string, projectId: string, data: {
  name?: string;
  clientId?: string | null;
  description?: string | null;
  status?: string;
  billingType?: string;
  contractAmount?: number;
  monthlyAmount?: number | null;
  hourlyRate?: number | null;
  estimatedHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  tags?: string | null;
}) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  // 既存値で部分更新の整合性チェック
  const existing = await prisma.promaneProject.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { startDate: true, endDate: true },
  });
  if (!existing) throw new Error("プロジェクトが見つかりません");

  if (data.name !== undefined && !data.name.trim()) throw new Error("プロジェクト名は必須です");
  if (data.contractAmount !== undefined) validateAmount(data.contractAmount, "契約金額");
  if (data.monthlyAmount !== undefined && data.monthlyAmount !== null) validateAmount(data.monthlyAmount, "月額");
  if (data.hourlyRate !== undefined && data.hourlyRate !== null) validateAmount(data.hourlyRate, "時給");
  if (data.estimatedHours !== undefined && data.estimatedHours !== null) validateAmount(data.estimatedHours, "見積工数");

  if (data.startDate !== undefined || data.endDate !== undefined) {
    const finalStart = data.startDate !== undefined ? data.startDate : existing.startDate;
    const finalEnd = data.endDate !== undefined ? data.endDate : existing.endDate;
    validateDates(finalStart, finalEnd);
  }

  const project = await prisma.promaneProject.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.description !== undefined && { description: data.description?.slice(0, 5000) || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.billingType !== undefined && { billingType: data.billingType }),
      ...(data.contractAmount !== undefined && { contractAmount: validateAmount(data.contractAmount, "契約金額") }),
      ...(data.monthlyAmount !== undefined && { monthlyAmount: data.monthlyAmount }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.tags !== undefined && { tags: data.tags?.slice(0, 500) || null }),
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}`);
  return project;
}

export async function deleteProject(workspaceSlug: string, projectId: string) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");
  await prisma.promaneProject.delete({ where: { id: projectId } });
  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}`);
}

/**
 * 既存の不正データを修復するユーティリティ
 * - 負の金額 → 0
 * - 逆転日付 → endDate=null
 */
export async function repairInvalidProjects(workspaceSlug: string): Promise<{ repaired: number }> {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, contractAmount: true, monthlyAmount: true, hourlyRate: true, estimatedHours: true, startDate: true, endDate: true },
  });
  let repaired = 0;
  for (const p of projects) {
    const fixes: any = {};
    if (p.contractAmount < 0) { fixes.contractAmount = 0; }
    if (p.monthlyAmount != null && p.monthlyAmount < 0) { fixes.monthlyAmount = 0; }
    if (p.hourlyRate != null && p.hourlyRate < 0) { fixes.hourlyRate = 0; }
    if (p.estimatedHours != null && p.estimatedHours < 0) { fixes.estimatedHours = 0; }
    if (p.startDate && p.endDate && p.endDate < p.startDate) { fixes.endDate = null; }
    if (Object.keys(fixes).length > 0) {
      await prisma.promaneProject.update({ where: { id: p.id }, data: fixes });
      repaired++;
    }
  }
  revalidatePath(`/promane/${workspaceSlug}`);
  return { repaired };
}
