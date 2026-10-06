import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

function editing(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'ION-INPUT') return true;
  const inner = el.shadowRoot?.activeElement;
  return inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement;
}

/**
 * O teclado não deve encolher o ion-app: isso deixa um vão entre a barra e as teclas.
 * A barra sobe só o quanto o viewport visível ficou mais curto que a tela.
 */
export function useKeyboardInset(): Ref<number> {
  const inset = ref(0);
  let frame = 0;
  let screen = window.innerHeight;

  function visibleBox(): { height: number; offset: number } {
    const viewport = window.visualViewport;
    if (!viewport) return { height: window.innerHeight, offset: 0 };
    return { height: viewport.height, offset: viewport.offsetTop };
  }

  function apply(): void {
    const { height, offset } = visibleBox();
    const layout = window.innerHeight;
    if (!editing()) screen = layout;
    const covered = Math.max(0, Math.round(screen - height - offset));
    const open = editing() && covered > 80;
    const lift = open ? Math.max(0, Math.round(layout - height - offset)) : 0;
    const root = document.documentElement;
    root.classList.toggle('fn-keyboard', open);
    root.style.setProperty('--fn-keyboard-lift', `${lift}px`);
    inset.value = open ? Math.max(covered, 1) : 0;
    if (open) window.requestAnimationFrame(snapDock);
  }

  function snapDock(): void {
    const dock = document.querySelector('ion-footer.fn-dock');
    const viewport = window.visualViewport;
    if (!(dock instanceof HTMLElement) || !viewport) return;
    if (!document.documentElement.classList.contains('fn-keyboard')) return;
    const gap = Math.round(viewport.height - dock.getBoundingClientRect().bottom);
    if (Math.abs(gap) <= 1) return;
    const current = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--fn-keyboard-lift'),
    );
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.max(0, Math.round(base - gap));
    if (next === Math.round(base)) return;
    document.documentElement.style.setProperty('--fn-keyboard-lift', `${next}px`);
  }

  function schedule(): void {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(apply);
  }

  function onOrientation(): void {
    screen = window.innerHeight;
    schedule();
  }

  onMounted(() => {
    screen = window.innerHeight;
    schedule();
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('orientationchange', onOrientation);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
  });

  onBeforeUnmount(() => {
    window.cancelAnimationFrame(frame);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('orientationchange', onOrientation);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    document.documentElement.classList.remove('fn-keyboard');
    document.documentElement.style.removeProperty('--fn-keyboard-lift');
  });

  return inset;
}
