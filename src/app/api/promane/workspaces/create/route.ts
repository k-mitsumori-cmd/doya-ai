export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createPromaneWorkspaceOperation } from '@/lib/promane/workspace-mutations';
import { promaneWorkspaceResponse, promaneWorkspaceFailure } from '@/lib/promane/workspace-response';
import { recordServiceUsage } from '@/lib/service-usage';
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: unknown } | undefined)?.id;
    if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'ログインが必要です', code: 'AUTH_REQUIRED' }, { status: 401 });
    const body: unknown = await req.json().catch(() => null);
    const result = await createPromaneWorkspaceOperation(userId, body);
    if (result.state === 'saved' && !result.replayed) await recordServiceUsage({ userId, serviceId: 'promane', action: 'ワークスペース作成', summary: result.entry.name, metadata: { workspaceId: result.entry.id } });
    return promaneWorkspaceResponse(result);
  } catch (error) { return promaneWorkspaceFailure(error); }
}
