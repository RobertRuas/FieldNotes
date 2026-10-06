import { Directory, Filesystem } from '@capacitor/filesystem';

function filePath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `fieldnotes/${safe}`;
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
};
