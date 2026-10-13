'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mensajeLogin } from '@/lib/errores';
import { validarLogin } from '@/lib/validaciones';

export type EstadoLogin = { error?: string; errores?: Record<string, string>; email?: string };

export async function iniciarSesion(_prev: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  const v = validarLogin(fd);
  const email = String(fd.get('email') ?? '');
  if (!v.ok) return { errores: v.errores, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) return { error: mensajeLogin(error), email };

  const next = String(fd.get('next') ?? '');
  redirect(next.startsWith('/app') ? next : '/app');
}
