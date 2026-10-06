import type { Directive } from 'vue';

export interface AriaState {
  label?: string;
  pressed?: boolean;
  checked?: boolean;
  role?: string;
}

/**
 * O wrapper do Ionic Vue não repassa aria-* nem role.
 * A diretiva grava no host; o Ionic então leva esses atributos
 * para o botão interno, onde o nome acessível é lido.
 */
export const vAria: Directive<HTMLElement, AriaState | string> = {
  mounted(el, binding) {
    paint(el, binding.value);
  },
  updated(el, binding) {
    paint(el, binding.value);
  },
};

function paint(el: HTMLElement, value: AriaState | string): void {
  const state = typeof value === 'string' ? { label: value } : value;
  if (state.label !== undefined) el.setAttribute('aria-label', state.label);
  if (state.pressed !== undefined) el.setAttribute('aria-pressed', state.pressed ? 'true' : 'false');
  if (state.checked !== undefined) el.setAttribute('aria-checked', state.checked ? 'true' : 'false');
  if (state.role) el.setAttribute('role', state.role);
}

declare module 'vue' {
  interface GlobalDirectives {
    aria: AriaState | string;
  }
}
