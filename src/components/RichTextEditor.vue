<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { editorKey, type EditorApi, type EditorCommand } from '@/composables/editorContext';
import { htmlToPlain, plainToHtml, sanitizeNoteHtml } from '@/utils/html';

const props = defineProps<{
  modelValue: string;
  revision: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const root = ref<HTMLElement | null>(null);
const empty = ref(true);
const slot = inject(editorKey, null);
let saved: Range | null = null;
let writing = false;

function publish(): void {
  if (writing || !root.value) return;
  empty.value = htmlToPlain(root.value.innerHTML).length === 0;
  emit('update:modelValue', root.value.innerHTML);
  keepCaret();
}

function fill(html: string): void {
  if (!root.value) return;
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

const api: EditorApi = {
  focus() {
    root.value?.focus();
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
  event.preventDefault();
  const html = event.clipboardData?.getData('text/html') ?? '';
  const text = event.clipboardData?.getData('text/plain') ?? '';
  exec('insertHTML', html ? sanitizeNoteHtml(html) : plainToHtml(text));
}

function onPointerDown(event: PointerEvent): void {
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

function keepCaret(): void {
  const selection = window.getSelection();
  if (!root.value || !selection || selection.rangeCount === 0) return;
  if (!root.value.contains(selection.anchorNode)) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const viewport = window.visualViewport;
  const bottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 88;
  if (rect.bottom > bottom) {
    const node = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
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
  window.visualViewport?.addEventListener('resize', keepCaret);
});

onBeforeUnmount(() => {
  if (slot) slot.value = null;
  window.visualViewport?.removeEventListener('resize', keepCaret);
});
</script>

<template>
  <div
    ref="root"
    class="fn-editor fn-note-content"
    :class="{ 'is-empty': empty }"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label="Texto da nota"
    data-placeholder="Escreva uma observação…"
    spellcheck="true"
    lang="pt-BR"
    autocapitalize="sentences"
    @input="publish"
    @paste="onPaste"
    @pointerdown="onPointerDown"
  />
</template>
