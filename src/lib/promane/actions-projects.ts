"use server";

import { parsePromaneWorkDate } from "@/lib/promane/time-input";
import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { getUserPromaneLimits, countUserProjects } from "@/lib/promane/limits";
import { revalidatePath } from "next/cache";

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

const STALE_PROJECT_ERROR = '別の画面で案件が更新されています。入力を保管してから最新版を開き直してください';

import type { Prisma } from '@prisma/client';
import { parsePromaneProjectInput, type PromaneProjectInput, type PromaneProjectPatch } from './project-input';
import { runPromaneProjectOnce, recoverPromaneProjectOperation, promaneProjectOperationId, isPromaneProjectReceiptConflict, type PromaneProjectOperationScope } from './project-operation';

async function lockProjectWriter(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const members = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM promane_members
    WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} AND "isActive"=true
      AND role IN ('owner','admin','member') FOR UPDATE`;
  if (members.length !== 1) throw new Error('ワークスペースの変更権限がありません');
}
async function retryProjectOperation<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await work(); }
    catch (error) {
      if (!isPromaneProjectReceiptConflict(error)) throw error;
      if (attempt === 2) throw new Error('同時に案件が変更されました。少し待って保存状態を確認してください');
    }
  }
  throw new Error('保存状態を確認できません');
}
function projectDates(input: {startDate?: string | null; endDate?: string | null}) {
  return {
    ...(input.startDate !== undefined && {startDate: input.startDate ? parsePromaneWorkDate(input.startDate) : null}),
    ...(input.endDate !== undefined && {endDate: input.endDate ? parsePromaneWorkDate(input.endDate) : null}),
  };
}
async function requireProjectClient(tx: Prisma.TransactionClient, workspaceId: string, clientId: string | null | undefined) {
  if (clientId && !await tx.promaneClient.findFirst({where: {id: clientId, workspaceId}, select: {id: true}})) throw new Error('取引先がワークスペースに存在しません');
}
function refreshProject(workspaceSlug: string, id?: string) {
  if (id) revalidatePath(`/promane/${workspaceSlug}/projects/${id}`);
  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}`);
}
export async function createProject(workspaceSlug: string, data: Partial<PromaneProjectInput> & {name: string; operationId: string; expectedUserId: string}) {
  const {userId} = await requirePromaneAuthAction();
  if (data.expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  if (!workspace.userId) throw new Error('ワークスペースの契約者を確認できません');
  const operationId = promaneProjectOperationId(data.operationId), input = parsePromaneProjectInput(data);
  const result = await retryProjectOperation(() => prisma.$transaction(async tx => {
    await lockProjectWriter(tx, workspace.id, userId);
    return runPromaneProjectOnce(tx, {workspaceId: workspace.id, userId, mode: 'create', projectId: null}, operationId, input,
      id => tx.promaneProject.findFirst({where: {id, workspaceId: workspace.id}}), async () => {
        await requireProjectClient(tx, workspace.id, input.clientId);
        const limits = await getUserPromaneLimits(workspace.userId, tx);
        const canManageBilling = userId === workspace.userId;
        if (limits.maxProjects === 0) return {state: 'rejected', code: 'LIMIT', canManageBilling,
          error: canManageBilling ? '現在のプランではプロジェクトを作成できません。プランをご確認ください' : '現在の契約ではプロジェクトを作成できません。ワークスペースの契約者にご相談ください'};
        if (limits.maxProjects > 0 && await countUserProjects(workspace.userId, tx) >= limits.maxProjects) {
          const guidance = canManageBilling ? 'プランをご確認ください' : '利用枠の変更はワークスペースの契約者にご相談ください';
          return {state: 'rejected', code: 'LIMIT', canManageBilling, error: `プラン上限 (${limits.maxProjects}件) に達しました。${guidance}`};
        }
        return {state: 'saved', entry: await tx.promaneProject.create({data: {...input, ...projectDates(input), workspaceId: workspace.id}})};
      });
  }, {isolationLevel: 'Serializable'}));
  if (result.state !== 'rejected') refreshProject(workspaceSlug, result.entry.id);
  return result;
}
export async function updateProject(workspaceSlug: string, projectId: string, data: PromaneProjectPatch & {operationId: string; expectedUserId: string}) {
  const {userId} = await requirePromaneAuthAction();
  if (data.expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  if (typeof projectId !== 'string' || !projectId || projectId.length > 200) throw new Error('案件を指定してください');
  const operationId = promaneProjectOperationId(data.operationId), input = parsePromaneProjectInput(data, true);
  const result = await retryProjectOperation(() => prisma.$transaction(async tx => {
    await lockProjectWriter(tx, workspace.id, userId);
    return runPromaneProjectOnce(tx, {workspaceId: workspace.id, userId, mode: 'update', projectId}, operationId, input,
      id => tx.promaneProject.findFirst({where: {id, workspaceId: workspace.id}}), async () => {
        const existing = await tx.promaneProject.findFirst({where: {id: projectId, workspaceId: workspace.id}});
        if (!existing) throw new Error('プロジェクトが見つかりません');
        const expected = new Date(input.expectedUpdatedAt);
        if (+existing.updatedAt !== +expected) return {state: 'rejected', code: 'STALE_PROJECT', error: STALE_PROJECT_ERROR};
        await requireProjectClient(tx, workspace.id, input.clientId);
        validateDates(input.startDate === undefined ? existing.startDate : input.startDate, input.endDate === undefined ? existing.endDate : input.endDate);
        const {expectedUpdatedAt: _revision, ...patch} = input;
        try {
          const entry = await tx.promaneProject.update({where: {id: projectId, workspaceId: workspace.id, updatedAt: expected},
            data: {...patch, ...projectDates(patch), updatedAt: new Date(Math.max(Date.now(), +expected + 1))}});
          return {state: 'saved', entry};
        } catch (error) {
          // P2025 has no failed SQL statement; a missing conditional match can safely record a terminal stale result.
          if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') return {state: 'rejected', code: 'STALE_PROJECT', error: STALE_PROJECT_ERROR};
          throw error;
        }
      });
  }, {isolationLevel: 'Serializable'}));
  if (result.state !== 'rejected') refreshProject(workspaceSlug, projectId);
  return result;
}
export async function recoverProjectOperation(workspaceSlug: string, mode: 'create' | 'update', projectId: string | null, operation: string, cancelIfMissing = false, expectedUserId = '') {
  const {userId} = await requirePromaneAuthAction();
  if (expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  if (typeof cancelIfMissing !== 'boolean' || !['create','update'].includes(mode) || (mode === 'create' ? projectId !== null : typeof projectId !== 'string' || !projectId || projectId.length > 200)) throw new Error('確認対象を指定してください');
  const scope = {workspaceId: workspace.id, userId, mode, projectId} as PromaneProjectOperationScope;
  const operationId = promaneProjectOperationId(operation);
  return retryProjectOperation(() => prisma.$transaction(async tx => {
    await lockProjectWriter(tx, workspace.id, userId);
    return recoverPromaneProjectOperation(tx, scope, operationId, id => tx.promaneProject.findFirst({where: {id, workspaceId: workspace.id}}), cancelIfMissing);
  }, {isolationLevel: 'Serializable'}));
}

export async function deleteProject(workspaceSlug: string, projectId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  await retryProjectTransaction(() => prisma.$transaction(async (tx) => {
    const member = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!member) throw new Error('ワークスペースの変更権限がありません');
    const deleted = await tx.promaneProject.deleteMany({
      where: { id: projectId, workspaceId: workspace.id },
    });
    if (deleted.count !== 1) throw new Error('プロジェクトが見つかりません');
  }, { isolationLevel: 'Serializable' }));
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
  const repaired = await retryProjectTransaction(() => prisma.$transaction(async tx => {
    const member = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin'] } },
      select: { id: true },
    });
    if (!member) throw new Error('データ修復はオーナー・管理者のみ実行できます');
    const projects = await tx.promaneProject.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, contractAmount: true, monthlyAmount: true, hourlyRate: true, estimatedHours: true, startDate: true, endDate: true },
    });
    let count = 0;
    for (const project of projects) {
      const fixes: any = {};
      if (project.contractAmount < 0) fixes.contractAmount = 0;
      if (project.monthlyAmount != null && project.monthlyAmount < 0) fixes.monthlyAmount = 0;
      if (project.hourlyRate != null && project.hourlyRate < 0) fixes.hourlyRate = 0;
      if (project.estimatedHours != null && project.estimatedHours < 0) fixes.estimatedHours = 0;
      if (project.startDate && project.endDate && project.endDate < project.startDate) fixes.endDate = null;
      if (Object.keys(fixes).length === 0) continue;
      const result = await tx.promaneProject.updateMany({
        where: {
          id: project.id, workspaceId: workspace.id,
          contractAmount: project.contractAmount, monthlyAmount: project.monthlyAmount,
          hourlyRate: project.hourlyRate, estimatedHours: project.estimatedHours,
          startDate: project.startDate, endDate: project.endDate,
        },
        data: fixes,
      });
      count += result.count;
    }
    return count;
  }, { isolationLevel: 'Serializable', timeout: 20_000 }));
  revalidatePath(`/promane/${workspaceSlug}`);
  return { repaired };
}
