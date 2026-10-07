import { computed, ref, watch, type Ref } from 'vue';
import type { NoteTemplate, TemplateVariable } from '@/templates/types';
import { seedAnswers } from '@/templates/utils/defaults';
import { answersForRender, renderTemplate } from '@/templates/utils/engine';
import { noteDateFrom, validateAnswer } from '@/templates/utils/validate';
import { activeVariables } from '@/templates/utils/variables';
import { todayKey } from '@/utils/dates';

export type WizardDestination = TemplateVariable | 'review';

export function useTemplateWizard(source: Ref<NoteTemplate | null>) {
  const answers = ref<Record<string, string>>({});
  const index = ref(0);
  const phase = ref<'ask' | 'review'>('ask');
  const error = ref('');
  const direction = ref<'forward' | 'back'>('forward');
  const seeded = ref<Record<string, string>>({});

  const steps = computed(() => (source.value ? activeVariables(source.value, answers.value) : []));

  const field = computed(() => (phase.value === 'ask' ? (steps.value[index.value] ?? null) : null));

  const progressLabel = computed(() => {
    const total = steps.value.length;
    if (total === 0) return '';
    const current = phase.value === 'review' ? total : Math.min(index.value + 1, total);
    return `${current} de ${total}`;
  });

  const progressRatio = computed(() => {
    const total = steps.value.length;
    if (total === 0) return 1;
    const done = phase.value === 'review' ? total : index.value;
    return done / total;
  });

  const canBack = computed(() => (phase.value === 'review' ? steps.value.length > 0 : index.value > 0));

  const dirty = computed(() => Object.entries(answers.value).some(([key, value]) => value !== (seeded.value[key] ?? '')));

  const preview = computed(() => {
    const template = source.value;
    if (!template) return '';
    return renderTemplate(template.content, template.variables, answersForRender(template, answers.value));
  });

  const actionLabel = computed(() => {
    if (phase.value === 'review') return 'Criar nota';
    return index.value >= steps.value.length - 1 ? 'Revisar' : 'Continuar';
  });

  function boot(): void {
    const template = source.value;
    if (!template) return;
    const initial = seedAnswers(template);
    answers.value = initial;
    seeded.value = { ...initial };
    index.value = 0;
    error.value = '';
    direction.value = 'forward';
    phase.value = activeVariables(template, initial).length === 0 ? 'review' : 'ask';
  }

  function setValue(value: string): void {
    const current = field.value;
    if (!current) return;
    answers.value = { ...answers.value, [current.key]: value };
    error.value = '';
  }

  function destination(): WizardDestination | 'invalid' | null {
    if (!source.value) return null;
    if (phase.value === 'review') return 'review';
    const current = field.value;
    if (!current) return 'review';
    const message = validateAnswer(current, answers.value[current.key] ?? '');
    if (message) {
      error.value = message;
      return 'invalid';
    }
    const upcoming = activeVariables(source.value, answers.value);
    const next = upcoming[index.value + 1];
    return next ?? 'review';
  }

  function advance(): void {
    const target = destination();
    if (target === 'invalid' || target === null) return;
    direction.value = 'forward';
    error.value = '';
    if (target === 'review') {
      phase.value = 'review';
      return;
    }
    index.value += 1;
  }

  function back(): void {
    direction.value = 'back';
    error.value = '';
    if (phase.value === 'review') {
      if (steps.value.length === 0) return;
      phase.value = 'ask';
      index.value = steps.value.length - 1;
      return;
    }
    if (index.value > 0) index.value -= 1;
  }

  function renderedAnswers(): Record<string, string> {
    const template = source.value;
    if (!template) return {};
    return answersForRender(template, answers.value);
  }

  function dateKey(): string {
    const template = source.value;
    if (!template) return todayKey();
    return noteDateFrom(template, answers.value);
  }

  watch(steps, (list) => {
    if (phase.value !== 'ask') return;
    if (list.length === 0) {
      phase.value = 'review';
      return;
    }
    if (index.value >= list.length) index.value = list.length - 1;
  });

  return {
    answers,
    index,
    phase,
    error,
    direction,
    steps,
    field,
    progressLabel,
    progressRatio,
    canBack,
    dirty,
    preview,
    actionLabel,
    boot,
    setValue,
    destination,
    advance,
    back,
    renderedAnswers,
    dateKey,
  };
}
