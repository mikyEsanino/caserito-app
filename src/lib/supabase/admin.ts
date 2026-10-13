import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './env';

/**
 * Cliente con la clave de servicio: salta RLS.
 * Solo se usa en el servidor para crear cuentas de ayudante (HU03).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY (revisa .env.local)');
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
