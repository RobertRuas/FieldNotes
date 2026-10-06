import type { ContentTextSize, ThemeMode } from '@/types/entities';

const LIGHT = '#efece6';
const DARK = '#12161c';

let listening = false;
let currentTheme: ThemeMode = 'light';
let currentSize: ContentTextSize = 'normal';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return prefersDark();
}

function ensureListener(): void {
  if (listening) return;
  listening = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'auto') applyThemeToDocument('auto', currentSize);
  });
}

export function applyThemeToDocument(theme: ThemeMode, textSize: ContentTextSize): void {
  currentTheme = theme;
  currentSize = textSize;
  ensureListener();
  const root = document.documentElement;
  const dark = resolveDark(theme);
  root.dataset.theme = theme;
  root.dataset.textSize = textSize;
  root.classList.toggle('ion-palette-dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK : LIGHT);
  try {
    localStorage.setItem('fn-theme', theme);
    localStorage.setItem('fn-text-size', textSize);
  } catch {
    // Sem localStorage o tema vale só nesta sessão.
  }
}
