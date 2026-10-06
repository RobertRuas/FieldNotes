import type { SupabaseClient } from '@supabase/supabase-js';
import { isRemoteConfigured } from '@/utils/env';

export const FILES_BUCKET = 'fieldnotes-files';

let clientPromise: Promise<SupabaseClient | null> | null = null;

async function load(): Promise<SupabaseClient | null> {
  if (!isRemoteConfigured()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const { createClient } = await import('@supabase/supabase-js');
  // Uma única instância: conta, fila e arquivos compartilham a mesma sessão.
  // Somente a anon key entra no cliente. A service role fica fora do app.
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!clientPromise) clientPromise = load();
  return clientPromise;
}

export async function hasRemoteSession(): Promise<boolean> {
  const client = await getSupabase();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data.session);
}
