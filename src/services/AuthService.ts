import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { getSupabase } from '@/services/supabaseClient';
import { enqueueWrite } from '@/sync/queue';
import type { User } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { isRemoteConfigured } from '@/utils/env';
import { createId } from '@/utils/id';

const USER_KEY = 'fieldnotes.userId';

let current: User | null = null;

export type AuthResult = { ok: true; user: User } | { ok: false; reason: string };

function localUser(now: string, patch: Pick<User, 'email' | 'displayName' | 'remoteId'>): User {
  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
    email: patch.email,
    displayName: patch.displayName,
    remoteId: patch.remoteId,
  };
}

async function processing(): Promise<boolean> {
  const count = await db.sync_queue.filter((row) => row.status === 'processing' && row.deletedAt === null).count();
  return count > 0;
}

async function adopt(remoteId: string, email: string | null, displayName: string | null): Promise<AuthResult> {
  const active = current ?? (await AuthService.ensureLocalUser());
  const linked = await db.users.filter((row) => row.remoteId === remoteId && row.deletedAt === null).first();
  if (linked && linked.id === active.id) {
    current = linked;
    return { ok: true, user: linked };
  }
  const switching = Boolean(linked && linked.id !== active.id) || Boolean(active.remoteId && active.remoteId !== remoteId);
  if (switching && (await processing())) {
    return { ok: false, reason: 'Ainda há um envio em andamento. Espere terminar para trocar de conta.' };
  }
  if (linked) {
    await preferenceSet(USER_KEY, linked.id);
    current = linked;
    return { ok: true, user: linked };
  }
  if (active.remoteId && active.remoteId !== remoteId) {
    const created = localUser(nowIso(), {
      email,
      displayName: displayName ?? email ?? 'Conta',
      remoteId,
    });
    await enqueueWrite(db.users, 'users', created, 'upsert');
    await preferenceSet(USER_KEY, created.id);
    current = created;
    return { ok: true, user: created };
  }
  const next: User = {
    ...active,
    email: email ?? active.email,
    displayName: displayName ?? active.displayName,
    remoteId,
    updatedAt: nowIso(),
    syncStatus: 'pending',
  };
  await enqueueWrite(db.users, 'users', next, 'upsert');
  current = next;
  return { ok: true, user: next };
}

async function sessionProfile(): Promise<{ id: string; email: string | null; displayName: string | null } | null> {
  const client = await getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const meta = user.user_metadata;
  const display = meta && typeof meta.display_name === 'string' ? meta.display_name : null;
  return { id: user.id, email: user.email ?? null, displayName: display };
}

export const AuthService = {
  current(): User | null {
    return current;
  },

  configured(): boolean {
    return isRemoteConfigured();
  },

  async ensureLocalUser(): Promise<User> {
    const existingId = await preferenceGet(USER_KEY);
    if (existingId) {
      const row = await db.users.get(existingId);
      if (row && row.deletedAt === null) {
        current = row;
        return row;
      }
    }
    const user = localUser(nowIso(), { email: null, displayName: 'Neste aparelho', remoteId: null });
    await enqueueWrite(db.users, 'users', user, 'upsert');
    await preferenceSet(USER_KEY, user.id);
    current = user;
    return user;
  },

  async restoreSession(): Promise<AuthResult | null> {
    const profile = await sessionProfile();
    if (!profile) return null;
    return adopt(profile.id, profile.email, profile.displayName);
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    const client = await getSupabase();
    if (!client) return { ok: false, reason: 'A nuvem ainda não está configurada neste aparelho.' };
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) return { ok: false, reason: error?.message ?? 'Não foi possível entrar.' };
    const meta = data.user.user_metadata;
    const display = meta && typeof meta.display_name === 'string' ? meta.display_name : null;
    return adopt(data.user.id, data.user.email ?? email.trim(), display);
  },

  async signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
    const client = await getSupabase();
    if (!client) return { ok: false, reason: 'A nuvem ainda não está configurada neste aparelho.' };
    const name = displayName.trim();
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name || email.trim() } },
    });
    if (error || !data.user) return { ok: false, reason: error?.message ?? 'Não foi possível criar a conta.' };
    if (!data.session) {
      return { ok: false, reason: 'Conta criada. Confirme o e-mail e depois entre.' };
    }
    return adopt(data.user.id, data.user.email ?? email.trim(), name || null);
  },

  async signOut(): Promise<AuthResult> {
    if (await processing()) {
      return { ok: false, reason: 'Ainda há um envio em andamento. Espere terminar para sair.' };
    }
    const client = await getSupabase();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) return { ok: false, reason: error.message };
    }
    const user = current ?? (await this.ensureLocalUser());
    return { ok: true, user };
  },
};
