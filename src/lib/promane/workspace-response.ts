import { NextResponse } from 'next/server';
import { PromaneWorkspaceRequestError } from './workspace-mutations';
import { PromaneWorkspaceOperationError } from './workspace-operation';

type Outcome = { state: string; entry?: unknown; code?: string };
export function promaneWorkspaceResponse(result: Outcome) {
  if (result.state === 'rejected') return NextResponse.json({ ...result, success: false }, { status: result.code === 'LIMIT_REACHED' ? 403 : 409 });
  const success = result.state === 'saved' || result.state === 'superseded';
  return NextResponse.json({ ...result, success, ...(success ? { workspace: result.entry } : {}) });
}
export function promaneWorkspaceFailure(error: unknown) {
  if (error instanceof PromaneWorkspaceRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof PromaneWorkspaceOperationError) return NextResponse.json({ error: error.message, code: 'OPERATION_CONFLICT' }, { status: 409 });
  console.error('[promane/workspaces] operation failed');
  return NextResponse.json({ error: '保存状態を確認できません。入力を保管し、保存状態を確認してください', code: 'UNKNOWN_OUTCOME' }, { status: 500 });
}
