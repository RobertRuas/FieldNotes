import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { AudioRecording } from '@/types/entities';

export const AudioService = {
  async list(userId: string): Promise<AudioRecording[]> {
    return db.audio_recordings.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async listForNote(noteId: string): Promise<AudioRecording[]> {
    return db.audio_recordings.filter((row) => row.noteId === noteId && row.deletedAt === null).toArray();
  },

  async persist(recording: AudioRecording): Promise<void> {
    const next: AudioRecording = {
      ...recording,
      syncStatus: recording.syncStatus === 'synced' ? 'synced' : 'pending',
    };
    await enqueueWrite(db.audio_recordings, 'audio_recordings', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
