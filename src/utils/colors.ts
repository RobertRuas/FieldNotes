export const COLLECTION_COLORS = ['#0e6b63', '#d4652f', '#3d5a80', '#8a5a44', '#5c6b4a', '#6b4c7a'] as const;

export function nextCollectionColor(index: number): string {
  return COLLECTION_COLORS[index % COLLECTION_COLORS.length] ?? COLLECTION_COLORS[0];
}
