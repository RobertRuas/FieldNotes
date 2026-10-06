import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export function useKeyboardInset(): Ref<number> {
  const inset = ref(0);

  function update(): void {
    const viewport = window.visualViewport;
    if (!viewport) {
      inset.value = 0;
      return;
    }
    const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
    inset.value = overlap > 80 ? Math.round(overlap) : 0;
  }

  onMounted(() => {
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
  });

  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    window.removeEventListener('orientationchange', update);
  });

  return inset;
}
