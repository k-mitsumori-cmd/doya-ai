"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/promane/utils";

const COLUMN_TOP_COLORS: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-violet-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export function KanbanColumn({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl bg-gray-100 overflow-hidden",
        isOver && "ring-2 ring-violet-400"
      )}
    >
      <div className={cn("h-1.5", COLUMN_TOP_COLORS[id] || "bg-gray-400")} />
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-base font-bold text-gray-700">{title}</h3>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-200 px-2 text-sm font-bold text-gray-600">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 min-h-[120px]">{children}</div>
    </div>
  );
}
