/** New records preserve project ownership even after task deletion; legacy rows fall back to the task. */
export function timeEntryBelongsToProject(
  entry: { projectId?: string | null; taskId: string | null },
  projectId: string,
  taskIds: string[],
): boolean {
  return entry.projectId != null
    ? entry.projectId === projectId
    : entry.taskId != null && taskIds.includes(entry.taskId)
}
