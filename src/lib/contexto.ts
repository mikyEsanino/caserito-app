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
    .select('id, nombre, email, rol, bodega_id, bodegas ( nombre, direccion )')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil) return null;

  const bodega = perfil.bodegas as unknown as { nombre: string; direccion: string } | null;
  return {
    userId: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol as Rol,
    bodegaId: perfil.bodega_id,
    bodegaNombre: bodega?.nombre ?? 'Mi bodega',
    bodegaDireccion: bodega?.direccion ?? '',
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
