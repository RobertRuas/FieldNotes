import type { Task, TaskPriority } from '@/types/entities';
import { fromLocalDateTimeInput, groupLabel, isDateKey, isTimeKey, toLocalDateTimeInput } from '@/utils/dates';

const PRIORITIES: readonly TaskPriority[] = ['baixa', 'normal', 'alta'];

export function isPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && PRIORITIES.some((item) => item === value);
}

export function priorityLabel(priority: TaskPriority): string {
  if (priority === 'baixa') return 'Baixa';
  if (priority === 'alta') return 'Alta';
  return 'Normal';
}

export function dueFromParts(date: string | null, time: string | null): string | null {
  if (!date || !isDateKey(date)) return null;
  const clock = time && isTimeKey(time) ? time : '00:00';
  return fromLocalDateTimeInput(`${date}T${clock}`);
}

function splitDue(dueAt: string): { date: string | null; time: string | null } {
  const local = toLocalDateTimeInput(dueAt);
  if (!local.includes('T')) return { date: null, time: null };
  const [date, time] = local.split('T');
  if (!date || !isDateKey(date)) return { date: null, time: null };
  return { date, time: time && isTimeKey(time) ? time : null };
}

export function normalizeTask(row: Task): Task {
  let date = row.date && isDateKey(row.date) ? row.date : null;
  let time = row.time && isTimeKey(row.time) ? row.time : null;
  if ((!date || !time) && row.dueAt) {
    const parts = splitDue(row.dueAt);
    if (!date) date = parts.date;
    if (!time && parts.time && parts.time !== '00:00') time = parts.time;
  }
  return {
    ...row,
    detail: row.detail ?? '',
    noteId: row.noteId ?? null,
    collectionId: row.collectionId ?? null,
    done: row.done === true,
    date,
    time,
    priority: isPriority(row.priority) ? row.priority : null,
    reminderAt: row.reminderAt ?? null,
    dueAt: dueFromParts(date, time),
  };
}

export interface TaskSection {
  id: string;
  title: string;
  tasks: Task[];
}

function byClock(left: Task, right: Task): number {
  const clock = (left.time ?? '99:99').localeCompare(right.time ?? '99:99');
  if (clock !== 0) return clock;
  return left.createdAt < right.createdAt ? -1 : 1;
}

export function openTaskSections(tasks: readonly Task[], today: string): TaskSection[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.done) continue;
    const key = task.date ?? 'sem-data';
    const bucket = groups.get(key) ?? [];
    bucket.push(task);
    groups.set(key, bucket);
  }
  return [...groups.keys()]
    .sort((left, right) => {
      if (left === 'sem-data') return 1;
      if (right === 'sem-data') return -1;
      return left < right ? -1 : 1;
    })
    .map((key) => ({
      id: key,
      title: key === 'sem-data' ? 'Sem data' : groupLabel(key, today),
      tasks: [...(groups.get(key) ?? [])].sort(byClock),
    }));
}

export function doneTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => task.done).sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
}

export function taskSummary(
  task: Task,
  today: string,
  collectionName: string | null,
  noteTitle: string | null,
): string {
  const parts: string[] = [];
  if (task.date) parts.push(groupLabel(task.date, today));
  if (task.time) parts.push(task.time);
  if (task.priority) parts.push(priorityLabel(task.priority));
  if (collectionName) parts.push(collectionName);
  if (noteTitle) parts.push(noteTitle);
  if (task.reminderAt) parts.push('Lembrete guardado');
  return parts.join(' · ');
}
