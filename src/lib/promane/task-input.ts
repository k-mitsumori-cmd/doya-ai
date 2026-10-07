import { parsePromaneWorkDate } from './time-input';

export type PromaneTaskCreate = {
  projectId: string; title: string; description: string | null;
  status: string; priority: string; assigneeId: string | null; parentId: string | null;
  startDate: string | null; dueDate: string | null;
};
export function parsePromaneTaskCreate(value: unknown): PromaneTaskCreate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('タスクの入力を確認してください');
  const data = value as Record<string, unknown>;
  if (typeof data.projectId !== 'string' || !data.projectId.trim() || data.projectId.length > 200) throw new Error('プロジェクトを指定してください');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new Error('タスク名は1〜200文字で入力してください');
  if (data.description != null && (typeof data.description !== 'string' || data.description.length > 5000)) throw new Error('タスクの説明は5000文字以内で入力してください');
  const status = data.status === undefined ? 'todo' : data.status;
  const priority = data.priority === undefined ? 'medium' : data.priority;
  if (typeof status !== 'string' || !['todo','in_progress','review','done'].includes(status)) throw new Error('タスクの状態が不正です');
  if (typeof priority !== 'string' || !['low','medium','high','urgent'].includes(priority)) throw new Error('タスクの優先度が不正です');
  const selection = (field: 'assigneeId' | 'parentId') => {
    const value = data[field];
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error('担当者・親タスクを確認してください');
    return value;
  };
  const date = (field: 'startDate' | 'dueDate') => {
    const value = data[field];
    if (value == null || value === '') return null;
    parsePromaneWorkDate(value);
    return value as string;
  };
  const startDate = date('startDate'), dueDate = date('dueDate');
  if (startDate && dueDate && dueDate < startDate) throw new Error('終了日は開始日以降を指定してください');
  return { projectId: data.projectId, title: data.title.trim(), description: data.description as string || null,
    status, priority, assigneeId: selection('assigneeId'), parentId: selection('parentId'), startDate, dueDate };
}
