"use client";

import { useState } from "react";
import { createTask } from "@/lib/promane/actions-tasks";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

export function TaskCreateForm({
  workspaceSlug,
  projectId,
  members,
}: {
  workspaceSlug: string;
  projectId: string;
  members: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // クライアント側でも日付チェック（即時フィードバック）
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      toast.error("終了日は開始日以降を指定してください", {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
      });
      return;
    }

    setLoading(true);
    try {
      await createTask(workspaceSlug, {
        projectId,
        title: title.trim(),
        assigneeId: assigneeId || undefined,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      });

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
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "タスク追加に失敗しました", {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all ${justAdded ? "animate-jelly" : ""}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <Image src="/character/point.png" alt="" width={32} height={32} className="drop-shadow-sm" unoptimized />
        <span className="text-[16px] font-black text-gray-800">タスクを追加しよう！</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="✏️ タスク名を入力..."
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
            <span className="text-[13px] font-bold text-gray-500">📅 開始</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 h-11 ring-1 ring-gray-200">
            <span className="text-[13px] font-bold text-gray-500">🏁 終了</span>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
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
      </form>
    </div>
  );
}
