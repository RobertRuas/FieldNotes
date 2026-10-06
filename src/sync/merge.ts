import type { EntityMeta } from '@/types/entities';

export function canApplyRemoteUpdate(
  local: Pick<EntityMeta, 'updatedAt' | 'syncStatus'> | undefined,
  remoteUpdatedAt: string,
): boolean {
  if (!local) return true;
  // Alteração local ainda não enviada não pode ser substituída pelo remoto.
  if (local.syncStatus !== 'synced') return false;
  return remoteUpdatedAt > local.updatedAt;
}
