export const VARIABLE_KEY = /^[\p{L}_][\p{L}\p{N}_]{0,39}$/u;

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function extractVariables(template: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of template.matchAll(TOKEN)) {
    const key = match[1]?.trim() ?? '';
    if (!VARIABLE_KEY.test(key) || seen.has(key)) continue;
    seen.add(key);
    found.push(key);
  }
  return found;
}

export function replaceVariableKey(content: string, from: string, to: string): string {
  return content.replace(TOKEN, (full, raw: string) => (raw.trim() === from ? `{{${to}}}` : full));
}

export function removeVariableKey(content: string, key: string): string {
  return content.replace(TOKEN, (full, raw: string) => (raw.trim() === key ? '' : full));
}
