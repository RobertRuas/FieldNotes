import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TemplateService } from '@/templates/services/TemplateService';
import type { NoteTemplate, TemplateMemory, TemplateVariable } from '@/templates/types';
import { memoryMap, memoryRows } from '@/templates/utils/variables';
import { useAuthStore } from '@/stores/authStore';
import { pushToast } from '@/composables/useToast';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

export interface TemplateDraft {
  name: string;
  content: string;
  variables: TemplateVariable[];
  customOrder?: boolean;
}

function copyVariable(variable: TemplateVariable): TemplateVariable {
  return {
    ...variable,
    id: createId(),
    options: variable.options.map((option) => ({ ...option, id: createId() })),
    when: variable.when ? { ...variable.when } : null,
  };
}

export const useTemplatesStore = defineStore('templatesStore', () => {
  const items = ref<NoteTemplate[]>([]);

  const ordered = computed(() =>
    [...items.value].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
  );

  const recent = computed(() =>
    [...items.value]
      .filter((item) => item.lastUsedAt)
      .sort((left, right) => ((left.lastUsedAt ?? '') < (right.lastUsedAt ?? '') ? 1 : -1))
      .slice(0, 6),
  );

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    items.value = await TemplateService.list(userId);
  }

  function find(id: string): NoteTemplate | undefined {
    return items.value.find((item) => item.id === id);
  }

  async function save(template: NoteTemplate, quiet = false): Promise<NoteTemplate | null> {
    const userId = useAuthStore().userId;
    if (!userId || !template.name.trim()) return null;
    const next: NoteTemplate = { ...template, userId, updatedAt: nowIso(), syncStatus: 'pending' };
    const index = items.value.findIndex((item) => item.id === next.id);
    const previous = index >= 0 ? items.value[index] : null;
    if (index === -1) items.value.unshift(next);
    else items.value[index] = next;
    try {
      await TemplateService.persist(next);
      const stored = find(next.id);
      return stored ?? next;
    } catch {
      if (previous) {
        const at = items.value.findIndex((item) => item.id === next.id);
        if (at === -1) items.value.unshift(previous);
        else items.value[at] = previous;
      } else {
        items.value = items.value.filter((item) => item.id !== next.id);
      }
      if (!quiet) pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
  }

  async function create(draft: TemplateDraft): Promise<NoteTemplate | null> {
    const userId = useAuthStore().userId;
    if (!userId) return null;
    const now = nowIso();
    const template: NoteTemplate = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      name: draft.name,
      content: draft.content,
      variables: draft.variables,
      favorite: false,
      lastUsedAt: null,
      lastValues: [],
      customOrder: draft.customOrder === true,
    };
    return save(template);
  }

  async function duplicate(id: string): Promise<NoteTemplate | null> {
    const current = find(id);
    if (!current) return null;
    const now = nowIso();
    const copy: NoteTemplate = {
      ...current,
      id: createId(),
      name: `${current.name} (cópia)`.slice(0, 80),
      variables: current.variables.map(copyVariable),
      favorite: false,
      lastUsedAt: null,
      lastValues: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    return save(copy);
  }

  async function remove(id: string): Promise<void> {
    const current = find(id);
    if (!current) return;
    const next: NoteTemplate = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    items.value = items.value.filter((item) => item.id !== id);
    try {
      await TemplateService.persist(next);
    } catch {
      items.value.unshift(current);
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function setFavorite(id: string, favorite: boolean): Promise<void> {
    const current = find(id);
    if (!current || current.favorite === favorite) return;
    await save({ ...current, favorite });
  }

  async function rememberRun(id: string, values: Record<string, string>): Promise<boolean> {
    const current = find(id);
    if (!current) return false;
    const merged = memoryMap(current.lastValues);
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) merged[key] = value;
    }
    const lastValues: TemplateMemory[] = memoryRows(merged);
    const saved = await save({ ...current, lastValues, lastUsedAt: nowIso() }, true);
    return saved !== null;
  }

  return {
    items,
    ordered,
    recent,
    hydrate,
    find,
    save,
    create,
    duplicate,
    remove,
    setFavorite,
    rememberRun,
  };
});
