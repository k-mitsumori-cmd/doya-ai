"use client";
import { useWorkspaceOperation } from '@/lib/promane/use-workspace-operation';
import { useConfirm } from '@/components/promane/confirm-dialog';
import { Button } from '@/components/promane/ui/button';
type Operation = ReturnType<typeof useWorkspaceOperation>;
export function WorkspaceOperationNotice({ operation, finish }: { operation: Operation; finish: (result: Awaited<ReturnType<Operation['save']>>) => void }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const pending = operation.status === 'unknown' || operation.status === 'blocked';
  return <>
    {operation.message && <div role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 break-words">
      <p>{operation.message}</p>
      {pending && <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={async () => finish(await operation.recover())}>保存状態を確認</Button>
        <Button type="button" variant="outline" onClick={async () => {
          if (!await confirm({ title: '未完了の送信を取り消す', message: '未保存の送信が後から反映されないようにします。保存済みのワークスペースは削除しません。', confirmLabel: '取り消す', tone: 'danger' })) return;
          finish(await operation.recover(true));
        }}>未完了の送信を取り消す</Button>
      </div>}
    </div>}
    <ConfirmDialog />
  </>;
}
