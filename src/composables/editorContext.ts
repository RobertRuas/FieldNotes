import type { InjectionKey, Ref } from 'vue';

export type EditorCommand = 'bold' | 'italic' | 'underline' | 'bullet' | 'ordered' | 'check';

export interface EditorApi {
  focus: () => void;
  rememberRange: () => void;
  run: (command: EditorCommand) => void;
  insertLink: (url: string) => void;
}

export const editorKey: InjectionKey<Ref<EditorApi | null>> = Symbol('fieldnotes-editor');
