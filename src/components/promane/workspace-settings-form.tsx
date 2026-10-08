"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/promane/ui/button';
import { Input } from '@/components/promane/ui/input';
import { useWorkspaceOperation } from '@/lib/promane/use-workspace-operation';
import { WorkspaceOperationNotice } from '@/components/promane/workspace-operation-notice';
import { useConfirm } from '@/components/promane/confirm-dialog';
import { toast } from 'sonner';
interface Props { workspace: { id: string; name: string; slug: string; updatedAt: string }; canEdit: boolean; currentSlug: string }
type Operation = ReturnType<typeof useWorkspaceOperation>;
export function WorkspaceSettingsForm(props: Props) {
  const operation = useWorkspaceOperation(props.workspace.id);
  return <WorkspaceSettingsDraft key={operation.scopeKey} {...props} operation={operation} />;
}
function WorkspaceSettingsDraft({ workspace, canEdit, currentSlug, operation }: Props & { operation: Operation }) {
  const router = useRouter(), submitting = useRef(false), { confirm, ConfirmDialog } = useConfirm();
  // Keep the draft and its original revision together during background refreshes.
  const [baseline, setBaseline] = useState(workspace), [name, setName] = useState(workspace.name), [slug, setSlug] = useState(workspace.slug);
  const changed = name !== baseline.name || slug !== baseline.slug;
  const busy = operation.status === 'saving' || operation.status === 'checking';
  function finish(result: Awaited<ReturnType<Operation['save']>>) {
    if (!result || (result.state !== 'saved' && result.state !== 'superseded')) return;
    setBaseline(result.entry); setName(result.entry.name); setSlug(result.entry.slug);
    toast.success(result.state === 'superseded' ? '保存後に別の編集がありました。最新版を表示します' : 'ワークスペース設定を保存しました');
    if (result.entry.slug !== currentSlug) router.push(`/promane/${result.entry.slug}/settings`);
    router.refresh();
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!canEdit || submitting.current || operation.status !== 'ready' || !changed) return;
    submitting.current = true;
    try { finish(await operation.save({ expectedUpdatedAt: baseline.updatedAt, name: name !== baseline.name ? name : undefined, slug: slug !== baseline.slug ? slug : undefined })); }
    finally { submitting.current = false; }
  }
  return <form onSubmit={submit} className="space-y-4">
    <WorkspaceOperationNotice operation={operation} finish={finish} />
    <fieldset disabled={!canEdit || operation.status !== 'ready'} className="space-y-4">
      <div><label htmlFor="workspace-settings-name" className="block text-sm font-bold text-gray-500 mb-2">ワークスペース名{!canEdit && '（編集権限なし）'}</label><Input id="workspace-settings-name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} className="h-12 rounded-2xl" /></div>
      <div><label htmlFor="workspace-settings-slug" className="block text-sm font-bold text-gray-500 mb-2">スラッグ（URL用）</label><div className="flex flex-wrap items-center gap-2"><span className="text-sm text-gray-500">/promane/</span><Input id="workspace-settings-slug" value={slug} onChange={e => setSlug(e.target.value)} required pattern="[a-zA-Z0-9][a-zA-Z0-9-]{2,49}" minLength={3} maxLength={50} className="min-w-0 flex-1 h-12 rounded-2xl" /></div><p className="text-xs text-gray-500 mt-1">半角英数字とハイフン（3〜50文字）。変更するとURLが変わります</p></div>
      {canEdit && <div className="flex justify-end"><Button type="submit" disabled={!changed}>{busy ? '保存中...' : '保存'}</Button></div>}
    </fieldset>
    <Button type="button" variant="outline" disabled={busy || operation.status !== 'ready'} onClick={async () => {
      if (changed && !await confirm({ title: '最新版を読み込む', message: 'この画面の未保存の入力を破棄して、保存済みの情報を読み込みます。', confirmLabel: '読み込む', tone: 'warning' })) return;
      window.location.reload();
    }}>最新版を読み込む</Button>
    <ConfirmDialog />
  </form>;
}
