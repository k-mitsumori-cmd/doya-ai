"use client";

import { useEffect, useRef, useState } from "react";
import { useTaskCreation } from '@/lib/promane/use-task-creation';
import { parsePromaneTaskCreate } from '@/lib/promane/task-input';
import { useConfirm } from '@/components/promane/confirm-dialog';
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

export function TaskCreateForm({
  workspaceSlug,
  workspaceId,
  projectId,
  members,
}: {
  workspaceSlug: string; workspaceId: string;
  projectId: string;
  members: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const creation = useTaskCreation(workspaceSlug, projectId, workspaceId);
  function refreshCreated() {
    const slug = creation.getWorkspaceSlug?.() || workspaceSlug;
    if (slug !== workspaceSlug) router.replace(`/promane/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}`);
    else router.refresh();
  }
  const loading = creation.status === 'saving' || creation.status === 'checking';
  const submitting = useRef(false);
  const { confirm, ConfirmDialog } = useConfirm();
  function clearDraft() { setTitle(''); setAssigneeId(''); setPriority('medium'); setStartDate(''); setDueDate(''); }
  useEffect(() => { clearDraft(); submitting.current = false; setJustAdded(false); }, [creation.scopeKey]);
  const [justAdded, setJustAdded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting.current || creation.status !== 'ready') return;
    submitting.current = true;
    try {
      const input = parsePromaneTaskCreate({ projectId, title, assigneeId, priority, startDate, dueDate });
      if (!await creation.save(input)) return;

      toast.success(`「${title.trim()}」を追加したよ！`, {
        icon: <Image src="/character/thumbsup.png" alt="" width={28} height={28} unoptimized />,
      });

      setTitle("");
      setAssigneeId("");
      setPriority("medium");
      setStartDate("");
      setDueDate("");
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 600);
      refreshCreated();
    } catch (e: any) {
      toast.error(e?.message || "タスク追加に失敗しました", {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        duration: 5000,
      });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all ${justAdded ? "animate-jelly" : ""}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <Image src="/character/point.png" alt="" width={32} height={32} className="drop-shadow-sm" unoptimized />
        <span className="text-[16px] font-black text-gray-800">タスクを追加しよう！</span>
      </div>
      {creation.message && <div role="status" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        <p>{creation.message}</p>
        {(creation.status === 'unknown' || creation.status === 'blocked') && <div className="flex flex-wrap gap-3 mt-3">
          <Button disabled={loading} onClick={async () => { if (await creation.recover() === 'found') { clearDraft(); refreshCreated(); } }}>保存状態を確認</Button>
          <Button disabled={loading} onClick={async () => {
            if (!await confirm({ title: '未完了の送信を取り消す', message: '未保存の送信が後から登録されないようにします。保存済みのタスクは削除しません。', confirmLabel: '取り消す', tone: 'danger' })) return;
            if (await creation.recover(true) === 'found') { clearDraft(); refreshCreated(); }
          }}>未完了の送信を取り消す</Button>
        </div>}
      </div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <fieldset disabled={creation.status !== 'ready'} className="space-y-3">
        <Input
          aria-label="タスク名"
          placeholder="✏️ タスク名を入力..."
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 rounded-2xl text-[16px] font-bold bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-400 transition-all"
        />
        <div className="flex flex-wrap items-end gap-3">
          <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")}>
            <SelectTrigger className="w-40 h-11 rounded-2xl text-[14px] font-bold bg-gray-50">
              <SelectValue placeholder="👤 担当者" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">👤 未割当</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>👤 {m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
            <SelectTrigger className="w-44 h-11 rounded-2xl text-[14px] font-bold bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">🐢 のんびり</SelectItem>
              <SelectItem value="medium">🚶 ふつう</SelectItem>
              <SelectItem value="high">🏃 いそぎ</SelectItem>
              <SelectItem value="urgent">🔥 超キンキュウ！</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 h-11 ring-1 ring-gray-200">
            <span className="shrink-0 whitespace-nowrap text-[13px] font-bold text-gray-500">📅 開始</span>
            <Input aria-label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 h-11 ring-1 ring-gray-200">
            <span className="shrink-0 whitespace-nowrap text-[13px] font-bold text-gray-500">🏁 終了</span>
            <Input aria-label="終了日" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
          </div>

          <Button
            type="submit"
            disabled={loading || !title.trim()}
            className="h-11 rounded-full font-black px-6 text-[15px] shadow-md bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="mr-1.5 h-5 w-5" />
            追加！
          </Button>
        </div>
        </fieldset>
      </form>
      <ConfirmDialog />
    </div>
  );
}
