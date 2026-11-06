"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/promane/ui/dialog";
import { formatCurrency } from "@/lib/promane/format";
import { Plus, Trash2, Building2, User, Mail, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useConfirm } from "@/components/promane/confirm-dialog";

import { useClientCreation } from '@/lib/promane/use-client-creation';
import { parsePromaneClientCreate } from '@/lib/promane/client-input';
import { userErrorMessage } from '@/lib/promane/user-error'
import { useAgentForm } from '@/components/agent-chat/useAgentForm'
import AgentBlocked from '@/components/agent-chat/AgentBlocked'
import { isAgentSubmit, type SubmitResult } from '@/components/agent-chat/form-bus'

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

type ClientActionsProps = { workspaceSlug: string; workspaceId: string; clients: ClientItem[] };

export function ClientActions({ canWrite, ...props }: ClientActionsProps & { canWrite: boolean }) {
  // 閲覧のみのワークスペースでは、会話に理由を伝えて止まる（画面は何も足さない。判定は画面の canWrite のまま）
  return canWrite ? <EditableClientActions {...props} /> : <><AgentBlocked formKey="promane.client.new" reason="このワークスペースでは閲覧のみのため、顧客を追加できません。オーナーまたは管理者に権限の変更を依頼してください。" /><ClientActionsContent {...props} /></>;
}

function EditableClientActions({ workspaceSlug, workspaceId, clients }: ClientActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyClientDraft);
  const creation = useClientCreation(workspaceSlug, workspaceId);
  function refreshCreated() {
    const slug = creation.getWorkspaceSlug?.() || workspaceSlug;
    if (slug !== workspaceSlug) router.replace(`/promane/${encodeURIComponent(slug)}/clients`);
    else router.refresh();
  }
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

  /**
   * 顧客の追加。画面のボタンも、会話（AgentDock）の確認ボタンも、この処理を通る（保存の処理はここ1つだけ）。
   * 会話からの保存では、通知（toast）を出さない。会話が完了を出してから、会話が移る。
   */
  async function createClient(inputDraft: ReturnType<typeof emptyClientDraft>): Promise<SubmitResult> {
    if (submission.current || creation.status !== 'ready') return { ok: false, error: creation.message || '保存の準備ができていません。少し待って、もう一度お試しください。' };
    submission.current = true;
    const byAgent = isAgentSubmit();
    try {
      const input = parsePromaneClientCreate(inputDraft);
      if (!await creation.save(input)) {
        // 画面の案内（保存状態の確認など）。保存が失敗した直後の最新の文を読む
        return { ok: false, error: creation.getMessage?.() || '顧客を追加できませんでした。画面の案内を確かめてください。' };
      }
      if (!byAgent) toast.success('顧客を追加しました！', { duration: 3000 });
      setDraft(emptyClientDraft());
      setOpen(false);
      const slug = creation.getWorkspaceSlug?.() || workspaceSlug;
      refreshCreated();
      return { ok: true, href: `/promane/${encodeURIComponent(slug)}/clients` };
    } catch (error) {
      const m = userErrorMessage(error instanceof Error ? error.message : null, '入力内容を確かめて、もう一度お試しください。');
      if (!byAgent) toast.error(m, { duration: 6000 });
      return { ok: false, error: m };
    } finally { submission.current = false; }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await createClient(rememberDraft(e.currentTarget));
  }

  // ---- 会話（AgentDock）から操作される口。欄の名前は src/lib/agent-chat/ops.ts の PROMANE_CLIENT_ADD ----
  useAgentForm('promane.client.new', {
    // 保存状態が確認できているときだけ入力できる。前の送信の結果が分からない（unknown）ときは、画面の案内を理由にして止まる
    ready: () => creation.status === 'ready' || creation.status === 'unknown',
    blocked: () => (creation.status === 'unknown' ? creation.message || '前の送信の結果を確認できていません。画面の「保存状態を確認」を押してください。' : null),
    prepare: async () => {
      setOpen(true);
      for (let i = 0; i < 20; i++) {
        if (document.querySelector('[data-agent-field="name"]')) return;
        await new Promise<void>((r) => setTimeout(r, 100));
      }
    },
    setValue: (key, value) => {
      if (!['name', 'contactName', 'email', 'phone'].includes(key)) return false;
      setDraft((d) => ({ ...d, [key]: value }));
      return true;
    },
    snapshot: () => ({ name: draft.name.trim(), contactName: draft.contactName.trim(), email: draft.email.trim(), phone: draft.phone.trim() }),
    submit: () => createClient(draft),
  });

  async function handleDelete(clientId: string, name: string) {
    const ok = await confirm({
      title: 'この顧客を削除しますか？',
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
        toast.error(userErrorMessage(data?.error, "削除できませんでした。少し待って、もう一度お試しください。"));
        return;
      }
      toast.success("顧客を削除しました");
      router.refresh();
    } catch (e: any) {
      console.error("[promane/client] delete exception");
      toast.error(userErrorMessage(e?.message, "通信できませんでした。通信を確かめて、もう一度お試しください。"));
    }
  }

  const recoveryPanel = creation.message ? (
        <div role="status" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p>{creation.message}</p>
          {(creation.status === 'unknown' || creation.status === 'blocked') && (
            <div className="flex flex-wrap gap-3 mt-3">
              <Button disabled={loading} onClick={async () => { if (await creation.recover() === 'found') { setDraft(emptyClientDraft()); setOpen(false); refreshCreated(); } }}>保存状態を確認</Button>
              <Button disabled={loading} onClick={async () => {
                const ok = await confirm({ title: '未完了の送信を取り消す', message: '未保存の送信が後から登録されないようにします。保存済みの顧客は削除しません。', confirmLabel: '取り消す', tone: 'danger' });
                if (!ok) return;
                if (await creation.recover(true) === 'found') { setDraft(emptyClientDraft()); setOpen(false); refreshCreated(); }
              }}>未完了の送信を取り消す</Button>
            </div>
          )}
        </div>
  ) : null;

  return <ClientActionsContent clients={clients} form={<>
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
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <fieldset disabled={creation.status !== 'ready'} className="space-y-4">
              <div>
                <Label htmlFor={`${inputId}-name`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">会社名</Label>
                <Input id={`${inputId}-name`} name="name" data-agent-field="name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={200} required className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="株式会社〇〇" />
              </div>
              <div>
                <Label htmlFor={`${inputId}-contactName`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">担当者名</Label>
                <Input id={`${inputId}-contactName`} name="contactName" data-agent-field="contactName" value={draft.contactName} onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))} className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="田中太郎" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`${inputId}-email`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">メール</Label>
                  <Input id={`${inputId}-email`} name="email" data-agent-field="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} type="email" className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
                <div>
                  <Label htmlFor={`${inputId}-phone`} className="text-[13px] font-bold text-gray-500 mb-1.5 block">電話</Label>
                  <Input id={`${inputId}-phone`} name="phone" data-agent-field="phone" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-full font-black text-[15px] shadow-md hover:scale-[1.02] active:scale-95 transition-all">
                {loading ? "追加中..." : "追加する"}
              </Button>
              </fieldset>
            </form>
          </DialogContent>
        </Dialog>
      </div>

</>} onDelete={handleDelete} confirmation={<ConfirmDialog />} />;
}

function ClientActionsContent({ clients, form, onDelete, confirmation }: Pick<ClientActionsProps, "clients"> & { form?: React.ReactNode; onDelete?: (id: string, name: string) => void; confirmation?: React.ReactNode }) {
  return (
    <>
      {form}
      {clients.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-24 text-center animate-bounce-in">
          <Image src="/character/surprise.png" alt="" width={120} height={120} className="mx-auto animate-float" unoptimized />
          <p className="mt-4 text-[20px] font-black text-gray-400">まだ顧客がいないよ</p>
          <p className="text-[15px] text-gray-300 font-bold mt-1">{onDelete ? "顧客を追加して案件を紐づけよう！" : "まだ顧客が登録されていません。"}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, i) => (
            <div key={client.id} className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:ring-amber-300 animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Building2 className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-gray-900">{client.name}</p>
                    {client.contactName && <p className="flex items-center gap-1 text-[13px] font-bold text-gray-400"><User className="h-3.5 w-3.5" aria-hidden />{client.contactName}</p>}
                  </div>
                </div>
                {onDelete && <button type="button" aria-label={`${client.name}を削除する`} onClick={() => onDelete?.(client.id, client.name)} className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>}
              </div>
              {client.email && <p className="flex items-center gap-1 text-[13px] font-bold text-gray-400 mb-1 break-all"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />{client.email}</p>}
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-gray-400">
                  <FolderOpen className="h-4 w-4" aria-hidden />{client.projectCount}件 (進行中 {client.activeCount})
                </span>
                <span className="text-[16px] font-black text-gray-900">{formatCurrency(client.totalRevenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmation}
    </>
  );
}
