<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { clipboardOutline, closeOutline, copyOutline, scanOutline } from 'ionicons/icons';
import { editorKey, type EditorApi, type EditorCommand } from '@/composables/editorContext';
import { pushToast } from '@/composables/useToast';
import { htmlToPlain, plainToHtml, sanitizeNoteHtml } from '@/utils/html';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    revision: number;
    editable?: boolean;
  }>(),
  {
    editable: true,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const root = ref<HTMLElement | null>(null);
const empty = ref(true);
const isAllSelected = ref(false);
const slot = inject(editorKey, null);
let saved: Range | null = null;
let writing = false;
let caretTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleKeepCaret(): void {
  if (caretTimer) clearTimeout(caretTimer);
  caretTimer = setTimeout(() => {
    void keepCaret();
  }, 120);
}

function publish(): void {
  if (writing || !root.value) return;
  empty.value = htmlToPlain(root.value.innerHTML).length === 0;
  emit('update:modelValue', root.value.innerHTML);
  scheduleKeepCaret();
}

function fill(html: string): void {
  if (!root.value) return;
  if (root.value.innerHTML === html) {
    empty.value = htmlToPlain(html).length === 0;
    return;
  }
  writing = true;
  root.value.innerHTML = html;
  empty.value = htmlToPlain(html).length === 0;
  writing = false;
}

function exec(command: string, value?: string): void {
  if (!root.value) return;
  root.value.focus();
  const doc = document as Document & {
    execCommand: (commandId: string, showUi?: boolean, commandValue?: string) => boolean;
  };
  doc.execCommand(command, false, value);
  publish();
}

function selectAll(): void {
  const field = root.value;
  if (!field) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(field);
  selection.removeAllRanges();
  selection.addRange(range);
  isAllSelected.value = true;
}

function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) selection.removeAllRanges();
  isAllSelected.value = false;
}

function toggleSelect(): void {
  if (isAllSelected.value) {
    clearSelection();
  } else {
    selectAll();
  }
}

async function copyText(): Promise<void> {
  const field = root.value;
  if (!field) return;
  const selection = window.getSelection();
  const selected = selection ? selection.toString() : '';
  const textToCopy = selected.trim() ? selected : htmlToPlain(field.innerHTML).trim();
  if (!textToCopy) {
    pushToast('Não há texto para copiar.');
    return;
  }
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const input = document.createElement('textarea');
      input.value = textToCopy;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      copied = document.execCommand('copy');
      input.remove();
    } catch {
      copied = false;
    }
  }
  if (copied) {
    pushToast('Texto copiado.');
  } else {
    pushToast('Não foi possível copiar o texto.');
  }
}

async function pasteText(): Promise<void> {
  if (!props.editable) return;
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const pasted = await navigator.clipboard.readText();
      if (pasted) {
        exec('insertHTML', plainToHtml(pasted));
        return;
      }
    }
  } catch {
    // Permissão ou não suportado
  }
  pushToast('Use o teclado ou toque longo para colar.');
}

const api: EditorApi = {
  focus() {
    const field = root.value;
    if (!field || !props.editable) return;
    if (htmlToPlain(field.innerHTML).length === 0) {
      field.innerHTML = '<p><br></p>';
      empty.value = true;
    }
    field.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    const target = field.querySelector('p') ?? field;
    range.selectNodeContents(target);
    range.collapse(htmlToPlain(field.innerHTML).length === 0);
    selection.removeAllRanges();
    selection.addRange(range);
  },
  selectAll() {
    selectAll();
  },
  clearSelection() {
    clearSelection();
  },
  rememberRange() {
    const selection = window.getSelection();
    saved = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
  },
  run(command: EditorCommand) {
    // Checklist da nota é um registro de tarefa, não uma lista no texto.
    if (command === 'check') return;
    if (command === 'bold') exec('bold');
    else if (command === 'italic') exec('italic');
    else if (command === 'underline') exec('underline');
    else if (command === 'bullet') exec('insertUnorderedList');
    else if (command === 'ordered') exec('insertOrderedList');
  },
  insertLink(url: string) {
    const selection = window.getSelection();
    root.value?.focus();
    if (saved && selection) {
      selection.removeAllRanges();
      selection.addRange(saved);
    }
    exec('createLink', url);
  },
};

function onPaste(event: ClipboardEvent): void {
  if (!props.editable) return;
  event.preventDefault();
  const html = event.clipboardData?.getData('text/html') ?? '';
  const text = event.clipboardData?.getData('text/plain') ?? '';
  exec('insertHTML', html ? sanitizeNoteHtml(html) : plainToHtml(text));
}

function onPointerDown(event: PointerEvent): void {
  if (!props.editable) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const box = target.closest('[data-box]');
  if (!box) return;
  const item = box.closest('li[data-check]');
  if (!(item instanceof HTMLElement)) return;
  event.preventDefault();
  const checked = item.getAttribute('aria-checked') === 'true';
  item.setAttribute('aria-checked', checked ? 'false' : 'true');
  publish();
}

async function keepCaret(): Promise<void> {
  const field = root.value;
  const selection = window.getSelection();
  if (!field || !selection || selection.rangeCount === 0) return;
  if (!field.contains(selection.anchorNode)) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.height === 0 && rect.top === 0) return;
  const host = field.closest('ion-content');
  if (!host || !('getScrollElement' in host)) return;
  const scroll = await (host as HTMLElement & { getScrollElement: () => Promise<HTMLElement> }).getScrollElement();
  const header = document.querySelector('.fn-appbar');
  const dock = document.querySelector('ion-footer.fn-dock');
  const topLimit = (header?.getBoundingClientRect().bottom ?? 0) + 12;
  const bottomLimit = (dock?.getBoundingClientRect().top ?? window.innerHeight) - 12;
  if (rect.top < topLimit) scroll.scrollTop -= topLimit - rect.top;
  else if (rect.bottom > bottomLimit) scroll.scrollTop += rect.bottom - bottomLimit;
}

function onViewport(): void {
  scheduleKeepCaret();
}

function checkSelectionChange(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.value) {
    isAllSelected.value = false;
    return;
  }
  if (!root.value.contains(selection.anchorNode)) {
    isAllSelected.value = false;
    return;
  }
  const selText = selection.toString().trim();
  const allText = (root.value.textContent || '').trim();
  isAllSelected.value = selText.length > 0 && selText === allText;
}

watch(
  () => props.revision,
  () => fill(props.modelValue),
);

onMounted(() => {
  const doc = document as Document & {
    execCommand: (commandId: string, showUi?: boolean, commandValue?: string) => boolean;
  };
  doc.execCommand('defaultParagraphSeparator', false, 'p');
  fill(props.modelValue);
  if (slot) slot.value = api;
  document.addEventListener('selectionchange', checkSelectionChange);
  window.visualViewport?.addEventListener('resize', onViewport);
  window.visualViewport?.addEventListener('scroll', onViewport);
});

onBeforeUnmount(() => {
  if (caretTimer) clearTimeout(caretTimer);
  if (slot) slot.value = null;
  document.removeEventListener('selectionchange', checkSelectionChange);
  window.visualViewport?.removeEventListener('resize', onViewport);
  window.visualViewport?.removeEventListener('scroll', onViewport);
});
</script>

<template>
  <div class="fn-editor-box">
    <div class="fn-editor-selection-actions" aria-label="Ações rápidas de texto">
      <button
        type="button"
        class="fn-selection-btn"
        :title="isAllSelected ? 'Desfazer seleção' : 'Selecionar tudo'"
        :aria-label="isAllSelected ? 'Desfazer seleção' : 'Selecionar tudo'"
        @click="toggleSelect"
      >
        <ion-icon :icon="isAllSelected ? closeOutline : scanOutline" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="fn-selection-btn"
        title="Copiar texto"
        aria-label="Copiar texto"
        @click="copyText"
      >
        <ion-icon :icon="copyOutline" aria-hidden="true" />
      </button>
      <button
        v-if="editable"
        type="button"
        class="fn-selection-btn"
        title="Colar texto"
        aria-label="Colar texto"
        @click="pasteText"
      >
        <ion-icon :icon="clipboardOutline" aria-hidden="true" />
      </button>
    </div>
    <div
      ref="root"
      class="fn-editor fn-note-content"
      :contenteditable="editable ? 'true' : 'false'"
      :inputmode="editable ? 'text' : undefined"
      :role="editable ? 'textbox' : 'article'"
      :aria-multiline="editable ? 'true' : undefined"
      aria-label="Texto da nota"
      :spellcheck="editable"
      lang="pt-BR"
      autocapitalize="sentences"
      @input="publish"
      @focus="scheduleKeepCaret"
      @paste="onPaste"
      @pointerdown="onPointerDown"
    />
    <div v-show="empty && editable" class="fn-editor-placeholder" aria-hidden="true">
      Escreva uma observação…
    </div>
  </div>
</template>
