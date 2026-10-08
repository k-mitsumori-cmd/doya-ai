export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePromaneWorkspaceOperation } from '@/lib/promane/workspace-mutations';
import { promaneWorkspaceResponse, promaneWorkspaceFailure } from '@/lib/promane/workspace-response';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: unknown } | undefined)?.id;
    if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'ログインが必要です', code: 'AUTH_REQUIRED' }, { status: 401 });
    const body: unknown = await req.json().catch(() => null);
    const result = await updatePromaneWorkspaceOperation(userId, (await ctx.params).id, body);

    return promaneWorkspaceResponse(result);
  } catch (error) { return promaneWorkspaceFailure(error); }
}
