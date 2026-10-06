import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { db } from '@/database/db';

function filePath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `fieldnotes/${safe}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('leitura'));
        return;
      }
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error('leitura'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

export const StorageService = {
  async writeBase64(name: string, data: string): Promise<string> {
    const path = filePath(name);
    const result = await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Data,
      recursive: true,
    });
    return result.uri;
  },

  async readBase64(name: string): Promise<string | null> {
    try {
      const result = await Filesystem.readFile({
        path: filePath(name),
        directory: Directory.Data,
      });
      return typeof result.data === 'string' ? result.data : null;
    } catch {
      return null;
    }
  },

  async remove(name: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: filePath(name), directory: Directory.Data });
    } catch {
      // Arquivo já ausente.
    }
  },

  /**
   * O original fica fora do registro da lista.
   * No aparelho nativo vai para o Filesystem; na PWA fica num blob local.
   */
  async writeBlob(id: string, blob: Blob, name: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const key = `${id}-${name}`;
      const data = await blobToBase64(blob);
      await this.writeBase64(key, data);
      return `fs:${key}`;
    }
    await db.local_files.put({ id, mimeType: blob.type || 'application/octet-stream', blob });
    return `local:${id}`;
  },

  async readBlob(id: string, localUri: string | null, mimeType: string): Promise<Blob | null> {
    if (localUri?.startsWith('fs:')) {
      const data = await this.readBase64(localUri.slice(3));
      return data ? base64ToBlob(data, mimeType) : null;
    }
    const row = await db.local_files.get(id);
    return row?.blob ?? null;
  },

  async removeBlob(id: string, localUri: string | null): Promise<void> {
    await db.local_files.delete(id);
    if (localUri?.startsWith('fs:')) await this.remove(localUri.slice(3));
  },
};
