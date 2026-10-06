import { ref } from 'vue';

const message = ref<string | null>(null);

export function pushToast(text: string): void {
  message.value = text;
}

export function useToast(): { message: typeof message; clear: () => void } {
  return {
    message,
    clear() {
      message.value = null;
    },
  };
}
