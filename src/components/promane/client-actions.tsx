"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/promane/ui/dialog";
import { formatCurrency } from "@/lib/promane/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useConfirm } from "@/components/promane/confirm-dialog";

import { useClientCreation } from '@/lib/promane/use-client-creation';
import { parsePromaneClientCreate } from '@/lib/promane/client-input';

const emptyClientDraft = () => ({ name: '', contactName: '', email: '', phone: '' });

type ClientItem = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  totalRevenue: number;
  projectCount: number;
  activeCount: number;
};

export function ClientActions({ workspaceSlug, clients }: { workspaceSlug: string; clients: ClientItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyClientDraft);
  const creation = useClientCreation(workspaceSlug);
  const loading = creation.status === 'saving' || creation.status === 'checking';
  const submission = useRef(false);
  const inputId = useId();
  useEffect(() => { setOpen(false); setDraft(emptyClientDraft()); submission.current = false; }, [creation.scopeKey]);
  const { confirm, ConfirmDialog } = useConfirm();

  function rememberDraft(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = { name: String(data.get('name') || ''), contactName: String(data.get('contactName') || ''),
      email: String(data.get('email') || ''), phone: String(data.get('phone') || '') };
    setDraft(next);
    return next;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submission.current || creation.status !== 'ready') return;
    submission.current = true;
    const inputDraft = rememberDraft(e.currentTarget);
    try {
      const input = parsePromaneClientCreate(inputDraft);
      if (!await creation.save(input)) return;
      toast.success('顧客を追加しました！', { duration: 3000 });
      setDraft(emptyClientDraft());
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '入力内容を確認してください', { duration: 6000 });
    } finally { submission.current = false; }
  }

  async function handleDelete(clientId: string, name: string) {
    const ok = await confirm({
      title: '顧客を削除',
      message: `「${name}」を削除しますか？\n関連する案件は保持されますが、顧客リンクは解除されます。`,
      tone: 'danger',
      confirmLabel: '削除する',
      icon: '/character/surprise.png',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/promane/clients?workspaceSlug=${encodeURIComponent(workspaceSlug)}&id=${encodeURIComponent(clientId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        toast.error(data?.error || "削除に失敗しました");
        return;
      }
      toast.success("顧客を削除しました");
      router.refresh();
    } catch (e: any) {
      console.error("[promane/client] delete exception");
      toast.error(e?.message || "通信エラーが発生しました");
    }
  }

  const recoveryPanel = creation.message ? (
        <div role="status" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p>{creation.message}</p>
          {(creation.status === 'unknown' || creation.status === 'blocked') && (
            <div className="flex flex-wrap gap-3 mt-3">
              <Button disabled={loading} onClick={async () => { if (await creation.recover() === 'found') { setDraft(emptyClientDraft()); setOpen(false); router.refresh(); } }}>保存状態を確認</Button>
              <Button disabled={loading} onClick={async () => {
                const ok = await confirm({ title: '未完了の送信を取り消す', message: '未保存の送信が後から登録されないようにします。保存済みの顧客は削除しません。', confirmLabel: '取り消す', tone: 'danger' });
                if (!ok) return;
                if (await creation.recover(true) === 'found') { setDraft(emptyClientDraft()); setOpen(false); router.refresh(); }
              }}>未完了の送信を取り消す</Button>
            </div>
          )}
        </div>
  ) : null;

  return (
    <>
      {!open && recoveryPanel}
      <div className="mb-6 animate-slide-up stagger-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button disabled={creation.status !== 'ready'} className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-105 active:scale-95 transition-all">
                <Plus className="mr-2 h-5 w-5" />
                顧客を追加
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <Image src="/character/love.png" alt="" width={32} height={32} unoptimized />
                  <span className="text-[18px] font-black">新しい顧客を追加</span>
                </div>
              </DialogTitle>
            </DialogHeader>
      {open && recoveryPanel}
            <form onChange={e => { rememberDraft(e.currentTarget); }} onSubmit={handleCreate} className="space-y-4 mt-2">
              <fieldset disabled={creation.status !== 'ready'} className="space-y-4">
              <div>
                <Label htmlFor={`${inputId}-name`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">🏢 会社名</Label>
                <Input id={`${inputId}-name`} name="name" defaultValue={draft.name} maxLength={200} required className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="株式会社〇〇" />
              </div>
              <div>
                <Label htmlFor={`${inputId}-contactName`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">👤 担当者名</Label>
                <Input id={`${inputId}-contactName`} name="contactName" defaultValue={draft.contactName} className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="田中太郎" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`${inputId}-email`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">📧 メール</Label>
                  <Input id={`${inputId}-email`} name="email" defaultValue={draft.email} type="email" className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
                <div>
                  <Label htmlFor={`${inputId}-phone`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">📱 電話</Label>
                  <Input id={`${inputId}-phone`} name="phone" defaultValue={draft.phone} className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-full font-black text-[15px] shadow-md hover:scale-[1.02] active:scale-95 transition-all">
                {loading ? "追加中..." : "追加する！ ✨"}
              </Button>
              </fieldset>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-24 text-center animate-bounce-in">
          <Image src="/character/surprise.png" alt="" width={120} height={120} className="mx-auto animate-float" unoptimized />
          <p className="mt-4 text-[20px] font-black text-gray-400">まだ顧客がいないよ</p>
          <p className="text-[15px] text-gray-300 font-bold mt-1">顧客を追加して案件を紐づけよう！</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, i) => (
            <div key={client.id} className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:ring-amber-300 animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl">
                    🏢
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-gray-900">{client.name}</p>
                    {client.contactName && <p className="text-[13px] font-bold text-gray-400">👤 {client.contactName}</p>}
                  </div>
                </div>
                <button onClick={() => handleDelete(client.id, client.name)} className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {client.email && <p className="text-[13px] font-bold text-gray-400 mb-1">📧 {client.email}</p>}
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[13px] font-bold text-gray-400">
                  📁 {client.projectCount}件 (進行中 {client.activeCount})
                </span>
                <span className="text-[16px] font-black text-gray-900">{formatCurrency(client.totalRevenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </>
  );
}
