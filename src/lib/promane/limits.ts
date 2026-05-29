// ============================================
// ドヤプロマネ プラン上限定義
// ============================================
// ドヤAI 統一プラン方式に準拠
// 詳細は doyalist/limits.ts / kintai と同じパターン

import { prisma } from "@/lib/prisma";
import { tierFrom, type PlanTier } from "@/lib/plan-utils";

export interface PromaneLimits {
  tier: PlanTier;
  maxProjects: number;        // プロジェクト数 (-1 = unlimited)
  maxMembersPerWorkspace: number;
  maxWorkspaces: number;
}

export const PROMANE_LIMITS: Record<PlanTier, PromaneLimits> = {
  GUEST: {
    tier: "GUEST",
    maxProjects: 0,
    maxMembersPerWorkspace: 0,
    maxWorkspaces: 0,
  },
  FREE: {
    tier: "FREE",
    maxProjects: 3,
    maxMembersPerWorkspace: 3,
    maxWorkspaces: 1,
  },
  LIGHT: {
    tier: "LIGHT",
    maxProjects: 20,
    maxMembersPerWorkspace: 10,
    maxWorkspaces: 3,
  },
  PRO: {
    tier: "PRO",
    maxProjects: -1, // 無制限
    maxMembersPerWorkspace: 50,
    maxWorkspaces: 10,
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    maxProjects: -1,
    maxMembersPerWorkspace: -1,
    maxWorkspaces: -1,
  },
};

/** ユーザーのプラン階層を取得 */
export async function getUserPromaneTier(userId: string): Promise<PlanTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return tierFrom(user?.plan);
}

/** ユーザーの上限情報を取得 */
export async function getUserPromaneLimits(userId: string): Promise<PromaneLimits> {
  const tier = await getUserPromaneTier(userId);
  return PROMANE_LIMITS[tier];
}

/** ユーザーの全workspaceでのプロジェクト総数 */
export async function countUserProjects(userId: string): Promise<number> {
  return prisma.promaneProject.count({
    where: { workspace: { members: { some: { userId, isActive: true } } } },
  });
}

/** ユーザーがメンバーになっているWS数 */
export async function countUserWorkspaces(userId: string): Promise<number> {
  return prisma.promaneMember.count({
    where: { userId, isActive: true },
  });
}

/** 残り作成可能数 (-1 = 無制限) */
export function remaining(used: number, max: number): number {
  if (max < 0) return -1;
  return Math.max(0, max - used);
}
