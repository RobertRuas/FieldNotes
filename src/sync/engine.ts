export type SyncPhase = 'offline' | 'syncing' | 'saved-local' | 'synced';

export function phaseFor(input: {
  online: boolean;
  syncing: boolean;
  pending: number;
  remoteConfigured: boolean;
}): SyncPhase {
  if (!input.online) return 'offline';
  if (input.syncing) return 'syncing';
  // Sem nuvem, ou com alterações ainda na fila, nada foi confirmado no servidor.
  if (!input.remoteConfigured || input.pending > 0) return 'saved-local';
  return 'synced';
}

export function phaseLabel(phase: SyncPhase): string {
  switch (phase) {
    case 'offline':
      return 'Offline — alterações salvas neste dispositivo';
    case 'syncing':
      return 'Sincronizando…';
    case 'saved-local':
      return 'Online — alterações salvas neste dispositivo';
    case 'synced':
      return 'Online/Sincronizado';
  }
}

export function backoffMs(attempts: number): number {
  const step = Math.min(6, Math.max(1, attempts));
  const base = 1000 * 2 ** (step - 1);
  const jitter = Math.floor(Math.random() * 300);
  return Math.min(60_000, base + jitter);
}
