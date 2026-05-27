"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/promane/utils";
import { Badge } from "@/components/promane/ui/badge";
import { PRIORITY_LABELS, PRIORITY_COLORS, formatDuration } from "@/lib/promane/format";
import { Clock, User } from "lucide-react";

type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  order: number;
  assigneeName: string | null;
  dueDate: string | null;
  totalMinutes: number;
};

export function KanbanCard({
  task,
  isDragging = false,
}: {
  task: TaskItem;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
  const isUrgent = task.priority === "urgent";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab rounded-2xl border-2 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5",
        (isDragging || isSortableDragging) && "opacity-60 shadow-xl rotate-2 scale-105",
        isOverdue && "border-l-4 border-l-red-400",
        isUrgent && "ring-2 ring-red-300 border-red-200",
        !isOverdue && !isUrgent && "border-gray-100",
      )}
    >
      <p className="text-[15px] font-bold text-gray-900">{task.title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={cn("text-[13px] font-black px-3 py-1 rounded-full", PRIORITY_COLORS[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.totalMinutes > 0 && (
          <span className="flex items-center gap-1 text-[13px] font-bold text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(task.totalMinutes)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {task.assigneeName ? (
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-gray-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-600">
              {task.assigneeName.charAt(0)}
            </div>
            {task.assigneeName}
          </span>
        ) : (
          <span />
        )}
        {task.dueDate && (
          <span className={cn("text-[13px] font-bold", isOverdue ? "text-red-500" : "text-gray-400")}>
            📅 {new Date(task.dueDate).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
            {isOverdue && " ⚠️"}
          </span>
        )}
      </div>
    </div>
  );
}
