import { onBeforeUnmount } from 'vue';

export function useAutosave(save: () => Promise<void>, delayMs = 400): {
  schedule: () => void;
  kick: () => Promise<void>;
  flush: () => Promise<void>;
  cancel: () => void;
} {
  let timer = 0;
  let dirty = false;
  let chain: Promise<void> = Promise.resolve();

  function run(): Promise<void> {
    dirty = false;
    window.clearTimeout(timer);
    chain = chain.then(save, save);
    return chain;
  }

  function schedule(): void {
    dirty = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (dirty) void run();
    }, delayMs);
  }

  function kick(): Promise<void> {
    dirty = true;
    return run();
  }

  async function flush(): Promise<void> {
    window.clearTimeout(timer);
    if (dirty) await run();
    else await chain;
  }

  function cancel(): void {
    dirty = false;
    window.clearTimeout(timer);
  }

  onBeforeUnmount(() => {
    window.clearTimeout(timer);
  });

  return { schedule, kick, flush, cancel };
}
