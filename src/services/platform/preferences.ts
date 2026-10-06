import { Preferences } from '@capacitor/preferences';

export async function preferenceGet(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

export async function preferenceSet(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch {
    try {
      localStorage.setItem(key, value);
    } catch {
      // A preferência fica só na memória desta sessão.
    }
  }
}
