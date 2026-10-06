export const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

export function parseDateKey(key: string): Date {
  const match = DATE_KEY.exec(key);
  const year = Number(match?.[1] ?? '1970');
  const month = Number(match?.[2] ?? '1');
  const day = Number(match?.[3] ?? '1');
  return new Date(year, month - 1, day);
}

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  return toDateKey(parseDateKey(value)) === value;
}

export function isTimeKey(value: string): boolean {
  return TIME_KEY.test(value);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function startOfWeek(key: string): string {
  const date = parseDateKey(key);
  const weekday = date.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function weekDates(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_item, index) => addDays(start, index));
}

export interface MonthCell {
  date: string;
  inMonth: boolean;
}

export function monthCells(anchor: string): MonthCell[] {
  const current = parseDateKey(anchor);
  const month = current.getMonth();
  let cursor = startOfWeek(toDateKey(new Date(current.getFullYear(), month, 1)));
  const cells: MonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    cells.push({ date: cursor, inMonth: parseDateKey(cursor).getMonth() === month });
    cursor = addDays(cursor, 1);
  }
  return cells;
}

export function dayNumber(key: string): number {
  return parseDateKey(key).getDate();
}

export function monthTitle(key: string): string {
  const date = parseDateKey(key);
  const name = MONTHS[date.getMonth()] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
}

export function longDateLabel(key: string): string {
  const label = parseDateKey(key).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function groupLabel(key: string, today: string): string {
  if (key === today) return 'Hoje';
  if (key === addDays(today, -1)) return 'Ontem';
  if (key === addDays(today, 1)) return 'Amanhã';
  return longDateLabel(key);
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function reminderLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
