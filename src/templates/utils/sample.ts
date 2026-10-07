import type { TemplateVariable } from '@/templates/types';
import { createId } from '@/utils/id';

function field(
  key: string,
  order: number,
  prompt: string,
  type: TemplateVariable['type'],
  extra: Partial<TemplateVariable> = {},
): TemplateVariable {
  return {
    id: createId(),
    key,
    label: prompt.replace(/\?$/, ''),
    prompt,
    type,
    required: true,
    placeholder: '',
    defaultKind: 'none',
    defaultValue: '',
    options: [],
    when: null,
    order,
    ...extra,
  };
}

export const DAILY_REPORT_CONTENT = `RELATÓRIO DIÁRIO

Data: {{data}}

Site: {{site}}

Turbina: {{turbina}}

Team Leader: {{tl}}

Horário:
{{inicio}} - {{fim}}

Atividade executada:

{{atividade}}

Standby:
{{standby}}

Observações:

{{observacoes}}
`;

export function dailyReportFields(): TemplateVariable[] {
  return [
    field('data', 0, 'Qual é a data?', 'date', { defaultKind: 'today' }),
    field('site', 1, 'Qual é o site?', 'text', { defaultKind: 'last', placeholder: 'Pannonia Gols' }),
    field('turbina', 2, 'Qual é o número da turbina?', 'text', { placeholder: 'GM08' }),
    field('tl', 3, 'Quem é o team leader?', 'text'),
    field('inicio', 4, 'Qual é o horário de início?', 'time', { defaultKind: 'static', defaultValue: '08:00' }),
    field('fim', 5, 'Qual é o horário de fim?', 'time', { defaultKind: 'static', defaultValue: '17:30' }),
    field('atividade', 6, 'Qual atividade foi executada?', 'long_text'),
    field('standby', 7, 'Houve standby?', 'boolean'),
    field('observacoes', 8, 'Alguma observação?', 'long_text', { required: false }),
  ];
}
