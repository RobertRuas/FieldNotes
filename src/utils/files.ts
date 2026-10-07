const MAX_BYTES = 12 * 1024 * 1024;

export function fileTooLarge(size: number): boolean {
  return size > MAX_BYTES;
}

export function fileSizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function clockLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Miniatura pequena. O original continua no arquivo local, não na lista. */
export async function thumbnailFor(blob: Blob): Promise<string | null> {
  if (!blob.type.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const max = 320;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

export function kindForDocument(file: File): 'document' | 'file' {
  const name = file.name.toLowerCase();
  const mime = file.type;
  if (mime.startsWith('image/')) return 'file';
  if (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    name.endsWith('.pdf') ||
    name.endsWith('.txt') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.rtf')
  ) {
    return 'document';
  }
  return 'file';
}
