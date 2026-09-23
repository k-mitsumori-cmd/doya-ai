"use server";

import { parsePromaneWorkDate, validatePromaneInteger, validatePromaneProjectText } from "./time-input";
import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { getUserPromaneLimits, countUserProjects } from "@/lib/promane/limits";
import { revalidatePath } from "next/cache";

/** 数値バリデーション: 0以上の整数を保証 */
function validateAmount(value: number | undefined | null, fieldName: string): number {
  return validatePromaneInteger(value === undefined ? 0 : value, fieldName);
}

/** 日付バリデーション: startDate <= endDate */
function validateDates(
  startDate?: string | Date | null,
  endDate?: string | Date | null
): { startDate: Date | null; endDate: Date | null } {
  const start = startDate == null || startDate === "" ? null : startDate instanceof Date ? startDate : parsePromaneWorkDate(startDate);
  const end = endDate == null || endDate === "" ? null : endDate instanceof Date ? endDate : parsePromaneWorkDate(endDate);
  if (start && isNaN(start.getTime())) throw new Error("開始日の形式が不正です");
  if (end && isNaN(end.getTime())) throw new Error("終了日の形式が不正です");
  if (start && end && end < start) {
    throw new Error("終了日は開始日以降を指定してください");
  }
  return { startDate: start, endDate: end };
}

async function retryProjectTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error;
      if (attempt === 2) throw new Error('同時に案件が変更されました。少し待って再度保存してください');
    }
  }
  throw new Error('案件を保存できませんでした');
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
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  validatePromaneProjectText(data);

  const contractAmount = validateAmount(data.contractAmount, "契約金額");
  const monthlyAmount = data.monthlyAmount != null ? validateAmount(data.monthlyAmount, "月額") : null;
  const hourlyRate = data.hourlyRate != null ? validateAmount(data.hourlyRate, "時給") : null;
  const estimatedHours = data.estimatedHours != null ? validateAmount(data.estimatedHours, "見積工数") : null;
  const { startDate, endDate } = validateDates(data.startDate, data.endDate);

  const commit = () => prisma.$transaction(async (tx) => {
    const member = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!member) throw new Error('ワークスペースの変更権限がありません');
    if (data.clientId) {
      const client = await tx.promaneClient.findFirst({
        where: { id: data.clientId, workspaceId: workspace.id }, select: { id: true },
      });
      if (!client) throw new Error("取引先がワークスペースに存在しません");
    }

    // プラン上限チェック (ドヤAI共通)
    const limits = await getUserPromaneLimits(userId, tx);
    if (limits.maxProjects === 0) {
      return { error: "現在のプランではプロジェクトを作成できません", code: "LIMIT" as const };
    }
    if (limits.maxProjects > 0) {
      const current = await countUserProjects(userId, tx);
      if (current >= limits.maxProjects) {
        return { error: `プラン上限 (${limits.maxProjects}件) に達しました。プランをアップグレードしてください`, code: "LIMIT" as const };
      }
    }

    return tx.promaneProject.create({
      data: {
        workspaceId: workspace.id,
        name: data.name.trim(),
        clientId: data.clientId || null,
        description: data.description || null,
        status: data.status || "draft",
        billingType: data.billingType || "fixed",
        contractAmount,
        monthlyAmount,
        hourlyRate,
        estimatedHours,
        startDate,
        endDate,
        tags: data.tags || null,
      },
    });

  }, { isolationLevel: 'Serializable' });
  const project = await retryProjectTransaction(commit);
  if ('error' in project) return project;

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
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  validatePromaneProjectText(data, true);

  const project = await retryProjectTransaction(() => prisma.$transaction(async (tx) => {
    const member = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!member) throw new Error('ワークスペースの変更権限がありません');
    // 既存値で部分更新の整合性チェック
    const existing = await tx.promaneProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
      select: { startDate: true, endDate: true },
    });
    if (!existing) throw new Error("プロジェクトが見つかりません");

    if (data.clientId) {
      const client = await tx.promaneClient.findFirst({
        where: { id: data.clientId, workspaceId: workspace.id }, select: { id: true },
      });
      if (!client) throw new Error("取引先がワークスペースに存在しません");
    }

    if (data.contractAmount !== undefined) validateAmount(data.contractAmount, "契約金額");
    if (data.monthlyAmount !== undefined && data.monthlyAmount !== null) validateAmount(data.monthlyAmount, "月額");
    if (data.hourlyRate !== undefined && data.hourlyRate !== null) validateAmount(data.hourlyRate, "時給");
    if (data.estimatedHours !== undefined && data.estimatedHours !== null) validateAmount(data.estimatedHours, "見積工数");

    let validatedDates: { startDate: Date | null; endDate: Date | null } | undefined;
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const finalStart = data.startDate !== undefined ? data.startDate : existing.startDate;
      const finalEnd = data.endDate !== undefined ? data.endDate : existing.endDate;
      validatedDates = validateDates(finalStart, finalEnd);
    }

    return tx.promaneProject.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.clientId !== undefined && { clientId: data.clientId || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.billingType !== undefined && { billingType: data.billingType }),
        ...(data.contractAmount !== undefined && { contractAmount: validateAmount(data.contractAmount, "契約金額") }),
        ...(data.monthlyAmount !== undefined && { monthlyAmount: data.monthlyAmount }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
        ...(data.startDate !== undefined && { startDate: validatedDates!.startDate }),
        ...(data.endDate !== undefined && { endDate: validatedDates!.endDate }),
        ...(data.tags !== undefined && { tags: data.tags || null }),
      },
    });

  }, { isolationLevel: 'Serializable' }));

  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}`);
  return project;
}

export async function deleteProject(workspaceSlug: string, projectId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  // セキュリティ: workspace所属確認 (IDOR防止)
  const existing = await prisma.promaneProject.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) throw new Error("プロジェクトが見つかりません");
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
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId, true);

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
      // Skip rows whose repair-relevant values changed after the scan.
      const result = await prisma.promaneProject.updateMany({
        where: {
          id: p.id, workspaceId: workspace.id,
          contractAmount: p.contractAmount, monthlyAmount: p.monthlyAmount,
          hourlyRate: p.hourlyRate, estimatedHours: p.estimatedHours,
          startDate: p.startDate, endDate: p.endDate,
        },
        data: fixes,
      });
      repaired += result.count;
    }
  }
  revalidatePath(`/promane/${workspaceSlug}`);
  return { repaired };
}
