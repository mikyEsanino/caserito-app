export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL (revisa .env.local)');
  return url;
}

export function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (revisa .env.local)');
  return key;
}
