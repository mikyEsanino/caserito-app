import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Rol = 'dueno' | 'ayudante';

export type Contexto = {
  userId: string;
  nombre: string;
  email: string;
  rol: Rol;
  bodegaId: string;
  bodegaNombre: string;
  bodegaDireccion: string;
  /** HU13: días de anticipación para avisar los lotes por vencer */
  diasAviso: number;
};

/** Usuario con sesión + su perfil y bodega. Se calcula una vez por request. */
export const getContexto = cache(async (): Promise<Contexto | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, nombre, email, rol, bodega_id, bodegas ( nombre, direccion, dias_aviso_vencimiento )')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil) return null;

  const bodega = perfil.bodegas as unknown as { nombre: string; direccion: string; dias_aviso_vencimiento: number } | null;
  return {
    userId: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol as Rol,
    bodegaId: perfil.bodega_id,
    bodegaNombre: bodega?.nombre ?? 'Mi bodega',
    bodegaDireccion: bodega?.direccion ?? '',
    diasAviso: bodega?.dias_aviso_vencimiento ?? 7,
  };
});

/** Exige sesión y perfil; una cuenta sin bodega va a /sin-perfil. */
export async function requireContexto(): Promise<Contexto> {
  const ctx = await getContexto();
  if (!ctx) redirect('/sin-perfil');
  return ctx;
}

/** HU03 CA2: las pantallas del dueño no se abren con rol ayudante. */
export async function requireDueno(): Promise<Contexto> {
  const ctx = await requireContexto();
  if (ctx.rol !== 'dueno') redirect('/app?restringido=1');
  return ctx;
}
