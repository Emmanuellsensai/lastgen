// Supabase realtime helpers. Meter readings and asset status changes push over
// a channel once the live backend is wired; in mock mode this is a no op.

import { supabase } from './supabase';

export type Unsubscribe = () => void;

export function subscribeToAsset(assetId: string, onChange: () => void): Unsubscribe {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client
    .channel(`asset:${assetId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
