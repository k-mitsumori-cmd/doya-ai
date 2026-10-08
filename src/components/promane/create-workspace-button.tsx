"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/promane/ui/button';
import { Input } from '@/components/promane/ui/input';
import { useWorkspaceOperation } from '@/lib/promane/use-workspace-operation';
import { WorkspaceOperationNotice } from '@/components/promane/workspace-operation-notice';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
export function CreateWorkspaceButton() {
  const router = useRouter(), operation = useWorkspaceOperation(null), submitting = useRef(false);
  const [open, setOpen] = useState(false), [name, setName] = useState('');
  const [limitNotice, setLimitNotice] = useState<{ message: string; href: string; label: string } | null>(null);
  const busy = operation.status === 'saving' || operation.status === 'checking';
  useEffect(() => { setName(''); setLimitNotice(null); submitting.current = false; }, [operation.scopeKey]);
  function finish(result: Awaited<ReturnType<typeof operation.save>>) {
    if (!result) return;
    if (result.state === 'rejected') {
      if (result.code === 'LIMIT_REACHED') setLimitNotice({ message: result.error, href: result.upgradeUrl || result.contactUrl!, label: result.upgradeUrl ? 'プランと料金を見る' : 'お問い合わせ' });
      return;
    }
    if (result.state === 'saved' || result.state === 'superseded') {
      toast.success(`「${result.entry.name}」を作成しました`); setOpen(false); setName('');
      router.push(`/promane/${result.entry.slug}`); router.refresh();
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (submitting.current || operation.status !== 'ready') return;
    submitting.current = true; setLimitNotice(null);
    try { finish(await operation.save({ name })); } finally { submitting.current = false; }
  }
  return <>
    <Button onClick={() => setOpen(true)} className="rounded-full h-11 px-5 text-sm font-black bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-1.5 h-4 w-4" />新規ワークスペース作成</Button>
    {open && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { if (!busy) setOpen(false); }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="workspace-create-title" className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-3"><h2 id="workspace-create-title" className="text-lg font-black text-gray-900">新規ワークスペース</h2><button type="button" disabled={busy} aria-label="閉じる" onClick={() => setOpen(false)} className="text-gray-500"><X className="h-5 w-5" /></button></div>
        <WorkspaceOperationNotice operation={operation} finish={finish} />
        <div><label htmlFor="workspace-create-name" className="block text-sm font-bold text-gray-700 mb-2">ワークスペース名（必須）</label><Input id="workspace-create-name" value={name} onChange={e => setName(e.target.value)} disabled={operation.status !== 'ready'} placeholder="例: マイ会社 / 顧客プロジェクト" maxLength={100} required autoFocus className="h-12 rounded-xl" /><p className="text-xs text-gray-500 mt-1">作成後、設定からスラッグも変更できます</p></div>
        {limitNotice && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{limitNotice.message}</p><Link href={limitNotice.href} className="mt-2 inline-block font-bold underline">{limitNotice.label} →</Link></div>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" disabled={busy} onClick={() => setOpen(false)} variant="outline">閉じる</Button><Button type="submit" disabled={operation.status !== 'ready' || !name.trim()}>{busy ? '確認中...' : '作成'}</Button></div>
      </form>
    </div>}
  </>;
}
