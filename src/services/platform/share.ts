import { Share } from '@capacitor/share';

export async function shareText(title: string, text: string): Promise<void> {
  await Share.share({ title, text, dialogTitle: title });
}
