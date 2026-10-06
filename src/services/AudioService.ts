import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { AudioRecording } from '@/types/entities';

export const AudioService = {
  async listForNote(noteId: string): Promise<AudioRecording[]> {
    return db.audio_recordings.filter((row) => row.noteId === noteId && row.deletedAt === null).toArray();
  },

  async persist(recording: AudioRecording): Promise<void> {
    await enqueueWrite(
      db.audio_recordings,
      'audio_recordings',
      { ...recording, syncStatus: 'pending' },
      recording.deletedAt ? 'delete' : 'upsert',
    );
  },
};
