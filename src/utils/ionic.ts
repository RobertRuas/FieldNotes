import { isRecord } from '@/utils/guards';

export interface ScrollableElement extends HTMLElement {
  scrollToTop?: (duration?: number) => Promise<void>;
  getScrollElement?: () => Promise<HTMLElement>;
}

export function ionElement(target: unknown): ScrollableElement | null {
  if (target instanceof HTMLElement) return target;
  if (isRecord(target) && target.$el instanceof HTMLElement) return target.$el;
  return null;
}

export async function scrollIonToTop(target: unknown, duration: number): Promise<void> {
  const element = ionElement(target);
  if (!element?.scrollToTop) return;
  await element.scrollToTop(duration);
}

export function readIonText(event: Event): string {
  if (!('detail' in event)) return '';
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail === 'string' || typeof detail === 'number') return String(detail);
  if (!isRecord(detail)) return '';
  const value = detail.value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}
