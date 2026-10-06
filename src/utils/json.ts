// A lib do TypeScript tipa JSON.parse como any; a fronteira devolve unknown.
export function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}
