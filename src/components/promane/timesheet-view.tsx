"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTimeEntry, deleteTimeEntry } from "@/lib/promane/actions-time-entries";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { formatDuration } from "@/lib/promane/format";
import { Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useConfirm } from "@/components/promane/confirm-dialog";

type EntryItem = { id: string; taskId: string | null; duration: number; date: string; note: string | null; taskTitle: string | null; projectName: string | null };
type ProjectWithTasks = { id: string; name: string; tasks: { id: string; title: string }[] };

export function TimesheetView({ workspaceSlug, memberId, entries, projects }: {
  workspaceSlug: string; memberId: string; entries: EntryItem[]; projects: ProjectWithTasks[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();
  const selectedProjectTasks = projects.find((p) => p.id === selectedProject)?.tasks || [];
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration, 0);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const hours = parseFloat(form.get("hours") as string) || 0;
    const minutes = parseFloat(form.get("minutes") as string) || 0;
    const duration = Math.round(hours * 60 + minutes);
    if (duration < 0) {
      toast.error("時間は 0以上を入力してください");
      setLoading(false);
      return;
    }
    try {
      await createTimeEntry(workspaceSlug, {
        taskId: (form.get("taskId") as string) || undefined,
        memberId,
        duration,
        date: form.get("date") as string,
        note: (form.get("note") as string) || undefined,
      });
      toast.success("作業時間を記録したよ！");
      setShowForm(false);
      router.refresh();
    } catch (e: any) {
      console.error("[promane/time] create exception", e);
      toast.error(e?.message || "記録に失敗しました", { duration: 6000 });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(entryId: string) {
    const ok = await confirm({
      title: '時間記録を削除',
      message: 'この時間記録を削除しますか？\n人件費の集計に影響します。',
      tone: 'danger',
      confirmLabel: '削除する',
      icon: '/character/surprise.png',
    });
    if (!ok) return;
    try {
      await deleteTimeEntry(workspaceSlug, entryId);
      toast.success("記録を削除したよ");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "削除に失敗しました");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 animate-slide-up stagger-1">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-100 px-4 py-2">
            <span className="text-[16px] font-black text-cyan-700">⏱ 合計 {formatDuration(totalMinutes)}</span>
          </div>
          <span className="text-[14px] font-bold text-gray-400">直近50件</span>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 hover:scale-105 active:scale-95 transition-all">
          <Plus className="mr-2 h-5 w-5" />
          時間を記録
        </Button>
      </div>

      {showForm && (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-2.5 mb-4">
            <Image src="/character/focus.png" alt="" width={32} height={32} unoptimized />
            <span className="text-[16px] font-black text-gray-800">作業時間を記録しよう！</span>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📁 プロジェクト</Label>
                <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v ?? "")}>
                  <SelectTrigger className="h-12 rounded-2xl font-bold bg-gray-50"><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📋 タスク</Label>
                <Select name="taskId">
                  <SelectTrigger className="h-12 rounded-2xl font-bold bg-gray-50"><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">なし</SelectItem>
                    {selectedProjectTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">⏰ 時間</Label>
                <Input name="hours" type="number" min="0" placeholder="1" className="h-12 rounded-2xl font-bold bg-gray-50 text-center text-[18px]" />
              </div>
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">⏰ 分</Label>
                <Input name="minutes" type="number" min="0" max="59" placeholder="30" className="h-12 rounded-2xl font-bold bg-gray-50 text-center text-[18px]" />
              </div>
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📅 日付</Label>
                <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required className="h-12 rounded-2xl font-bold bg-gray-50" />
              </div>
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📝 メモ</Label>
                <Input name="note" placeholder="作業内容" className="h-12 rounded-2xl font-bold bg-gray-50" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="rounded-full h-12 px-8 font-black text-[15px] shadow-md hover:scale-[1.02] active:scale-95 transition-all">
              {loading ? "記録中..." : "記録する！ ✨"}
            </Button>
          </form>
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden animate-slide-up stagger-2">
        {entries.length === 0 ? (
          <div className="py-24 text-center">
            <Image src="/character/sleep.png" alt="" width={120} height={120} className="mx-auto animate-float" unoptimized />
            <p className="mt-4 text-[20px] font-black text-gray-400">まだ記録がないよ〜</p>
            <p className="text-[15px] text-gray-300 font-bold mt-1">今日の作業時間を記録してみよう！</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry, i) => (
              <div key={entry.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-blue-50/40 transition-all animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100">
                  <Clock className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-black text-gray-900">{formatDuration(entry.duration)}</span>
                    {entry.projectName && <span className="text-[14px] font-bold text-gray-400">📁 {entry.projectName}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.taskTitle && <span className="text-[13px] font-bold text-gray-400">📋 {entry.taskTitle}</span>}
                    {entry.note && <span className="text-[13px] text-gray-300">— {entry.note}</span>}
                  </div>
                </div>
                <span className="text-[14px] font-bold text-gray-400">
                  📅 {new Date(entry.date).toLocaleDateString("ja-JP")}
                </span>
                <button onClick={() => handleDelete(entry.id)} className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </>
  );
}
