"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { moveTask } from "@/lib/promane/actions-tasks";
import { TASK_STATUS_LABELS } from "@/lib/promane/format";
import { toast } from "sonner";
import Image from "next/image";
import { TaskEditModal } from "./task-edit-modal";

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  order: number;
  assigneeId?: string | null;
  assigneeName: string | null;
  startDate?: string | null;
  dueDate: string | null;
  totalMinutes: number;
};

const COLUMNS = ["todo", "in_progress", "review", "done"] as const;

export function KanbanBoard({
  tasks: initialTasks,
  workspaceSlug,
  members = [],
}: {
  tasks: TaskItem[];
  workspaceSlug: string;
  members?: { id: string; displayName: string }[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let newStatus: string;
    if (COLUMNS.includes(overId as (typeof COLUMNS)[number])) {
      newStatus = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    await moveTask(workspaceSlug, taskId, newStatus, task.order);

    if (newStatus === "done") {
      toast.success(`🎉 「${task.title}」完了おめでとう！！`, {
        icon: <Image src="/character/jump.png" alt="" width={36} height={36} unoptimized />,
        duration: 4000,
        style: {
          background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
          border: "2px solid #818cf8",
          fontSize: "15px",
          fontWeight: 900,
        },
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((status) => {
          const columnTasks = tasks
            .filter((t) => t.status === status)
            .sort((a, b) => a.order - b.order);

          return (
            <KanbanColumn
              key={status}
              id={status}
              title={TASK_STATUS_LABELS[status]}
              count={columnTasks.length}
            >
              <SortableContext
                items={columnTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {columnTasks.map((task) => (
                  <KanbanCard key={task.id} task={task} onEdit={() => setEditingTask(task)} />
                ))}
              </SortableContext>
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} isDragging />}
      </DragOverlay>

      {editingTask && (
        <TaskEditModal
          workspaceSlug={workspaceSlug}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={{
            id: editingTask.id,
            title: editingTask.title,
            description: editingTask.description ?? null,
            status: editingTask.status,
            priority: editingTask.priority,
            assigneeId: editingTask.assigneeId ?? null,
            startDate: editingTask.startDate ?? null,
            dueDate: editingTask.dueDate ?? null,
          }}
          members={members}
        />
      )}
    </DndContext>
  );
}
