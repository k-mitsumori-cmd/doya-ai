"use client";

import { useState } from "react";
import { cn } from "@/lib/promane/utils";
import { TASK_STATUS_LABELS } from "@/lib/promane/format";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/promane/ui/button";
import { updateTask } from "@/lib/promane/actions-tasks";
import { useRouter } from "next/navigation";
import { Input } from "@/components/promane/ui/input";
import { toast } from "sonner";
import Image from "next/image";

type GanttTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
};

const STATUS_COLORS: Record<string, { bar: string; bg: string; dot: string; emoji: string }> = {
  todo: { bar: "bg-indigo-400", bg: "bg-indigo-50/50", dot: "bg-indigo-400", emoji: "📋" },
  in_progress: { bar: "bg-blue-500", bg: "bg-blue-50", dot: "bg-blue-500", emoji: "🔵" },
  review: { bar: "bg-amber-500", bg: "bg-amber-50", dot: "bg-amber-500", emoji: "🟡" },
  done: { bar: "bg-green-500", bg: "bg-green-50", dot: "bg-green-500", emoji: "🟢" },
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMondayOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function GanttChart({
  tasks,
  workspaceSlug,
}: {
  tasks: GanttTask[];
  workspaceSlug: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
}) {
  const router = useRouter();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const [viewStart, setViewStart] = useState(() => getMondayOfWeek(now));
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const DAYS_SHOWN = 14;
  const viewEnd = addDays(viewStart, DAYS_SHOWN - 1);
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i));

  function prevPeriod() { setViewStart(addDays(viewStart, -7)); }
  function nextPeriod() { setViewStart(addDays(viewStart, 7)); }
  function goToday() { setViewStart(getMondayOfWeek(now)); }

  const headerLabel = `${viewStart.getMonth() + 1}/${viewStart.getDate()} 〜 ${viewEnd.getMonth() + 1}/${viewEnd.getDate()}`;
  const todayIndex = days.findIndex((d) => isSameDay(d, now));

  function getBarPosition(task: GanttTask) {
    if (!task.startDate && !task.dueDate) return null;
    const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
    const end = task.dueDate ? new Date(task.dueDate) : start;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end < viewStart || start > viewEnd) return null;
    const barStartDay = start < viewStart ? 0 : Math.floor((start.getTime() - viewStart.getTime()) / 86400000);
    const barEndDay = end > viewEnd ? DAYS_SHOWN - 1 : Math.floor((end.getTime() - viewStart.getTime()) / 86400000);
    return {
      left: `${(barStartDay / DAYS_SHOWN) * 100}%`,
      width: `${Math.max(((barEndDay - barStartDay + 1) / DAYS_SHOWN) * 100, 100 / DAYS_SHOWN)}%`,
    };
  }

  async function handleSaveDates(taskId: string) {
    const taskName = tasks.find((t) => t.id === taskId)?.title || "タスク";
    await updateTask(workspaceSlug, taskId, {
      startDate: editStart || null,
      dueDate: editEnd || null,
    });
    toast.success(`「${taskName}」の日程を保存したよ！`, {
      icon: <Image src="/character/success.png" alt="" width={28} height={28} unoptimized />,
    });
    setEditingTask(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_COLORS).map(([key, c]) => (
            <span key={key} className="flex items-center gap-1 text-[12px] font-semibold text-gray-500">
              {c.emoji} {TASK_STATUS_LABELS[key]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="rounded-xl font-semibold text-[13px] h-8 px-3">
            <Calendar className="mr-1 h-3.5 w-3.5" />今日
          </Button>
          <Button variant="ghost" size="sm" onClick={prevPeriod} className="h-8 w-8 p-0 rounded-xl">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[130px] text-center text-[14px] font-bold text-gray-700">{headerLabel}</span>
          <Button variant="ghost" size="sm" onClick={nextPeriod} className="h-8 w-8 p-0 rounded-xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* タスク名列 */}
        <div className="w-[240px] flex-shrink-0 border-r border-gray-100">
          <div className="flex h-12 items-center border-b border-gray-100 px-4">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">タスク</span>
          </div>
          {tasks.map((task) => {
            const sc = STATUS_COLORS[task.status] || STATUS_COLORS.todo;
            return (
              <div key={task.id} className={cn("flex h-[52px] items-center border-b border-gray-50 px-4 gap-2.5", sc.bg)}>
                <span className="text-base flex-shrink-0">{sc.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-gray-800">{task.title}</p>
                  {task.assigneeName && (
                    <p className="text-[11px] text-gray-400 font-medium truncate">{task.assigneeName}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* タイムラインエリア */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-12 border-b border-gray-100">
            {days.map((day, i) => {
              const isToday = i === todayIndex;
              const dow = day.getDay();
              const isWeekend = dow === 0 || dow === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-50",
                    isToday ? "bg-blue-50" : isWeekend ? "bg-rose-50/50" : ""
                  )}
                  style={{ width: `${100 / DAYS_SHOWN}%`, minWidth: "52px" }}
                >
                  <span className={cn("text-[10px] font-bold", isWeekend ? "text-rose-400" : "text-gray-400")}>
                    {DAY_LABELS[dow]}
                  </span>
                  {isToday ? (
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-[12px] font-bold">
                      {day.getDate()}
                    </span>
                  ) : (
                    <span className={cn("text-[13px] font-bold", isWeekend ? "text-rose-400" : "text-gray-600")}>
                      {day.getDate()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {tasks.map((task) => {
            const bar = getBarPosition(task);
            const sc = STATUS_COLORS[task.status] || STATUS_COLORS.todo;
            return (
              <div
                key={task.id}
                className="relative flex h-[52px] items-center border-b border-gray-50 cursor-pointer hover:bg-blue-50/30 transition-colors"
                onClick={() => {
                  setEditingTask(editingTask === task.id ? null : task.id);
                  setEditStart(task.startDate ? task.startDate.split("T")[0] : "");
                  setEditEnd(task.dueDate ? task.dueDate.split("T")[0] : "");
                }}
              >
                {days.map((day, i) => {
                  const isToday = i === todayIndex;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute top-0 bottom-0 border-r border-gray-50",
                        isToday && "bg-blue-50/40",
                        isWeekend && "bg-rose-50/30"
                      )}
                      style={{ left: `${(i / DAYS_SHOWN) * 100}%`, width: `${100 / DAYS_SHOWN}%` }}
                    />
                  );
                })}

                {todayIndex >= 0 && (
                  <div className="absolute top-0 bottom-0 w-[2px] bg-blue-500 z-10 opacity-60" style={{ left: `${((todayIndex + 0.5) / DAYS_SHOWN) * 100}%` }} />
                )}

                {bar ? (
                  <div
                    className={cn("absolute z-20 h-7 rounded-full shadow-sm flex items-center px-3 overflow-hidden", sc.bar)}
                    style={{ left: bar.left, width: bar.width }}
                  >
                    <span className="truncate text-[11px] font-bold text-white">{task.title}</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <span className="text-[12px] font-semibold text-gray-300">クリックして日程設定</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editingTask && (
        <div className="border-t border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50 px-6 py-4 animate-slide-up">
          <div className="flex items-center gap-5 flex-wrap">
            <Image src="/character/focus.png" alt="" width={40} height={40} className="animate-bounce-in drop-shadow-md" unoptimized />
            <span className="text-[16px] font-black text-gray-800">
              {tasks.find((t) => t.id === editingTask)?.title}
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 h-11 ring-1 ring-blue-200 shadow-sm">
              <span className="text-[14px] font-bold text-blue-600">📅 開始</span>
              <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 h-11 ring-1 ring-blue-200 shadow-sm">
              <span className="text-[14px] font-bold text-blue-600">🏁 終了</span>
              <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="h-8 w-[130px] border-0 bg-transparent text-[14px] font-bold p-0 focus:ring-0" />
            </div>
            <Button onClick={() => handleSaveDates(editingTask)} className="h-11 rounded-full font-black px-6 text-[14px] shadow-md bg-gradient-to-r from-blue-500 to-violet-600 hover:scale-105 active:scale-95 transition-all">
              ✨ 保存！
            </Button>
            <button onClick={() => setEditingTask(null)} className="text-[14px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
