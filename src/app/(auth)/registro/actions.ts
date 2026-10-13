'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MSJ_CORREO_REGISTRADO, mensajeRegistro } from '@/lib/errores';
import { validarRegistro } from '@/lib/validaciones';

export type EstadoRegistro = {
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  confirmarCorreo?: string;
};

export async function registrarBodega(_prev: EstadoRegistro, fd: FormData): Promise<EstadoRegistro> {
  const valores = {
    nombre_bodega: String(fd.get('nombre_bodega') ?? ''),
    direccion: String(fd.get('direccion') ?? ''),
    nombre: String(fd.get('nombre') ?? ''),
    email: String(fd.get('email') ?? ''),
  };
  const v = validarRegistro(fd);
  if (!v.ok) return { errores: v.errores, valores };

  const { email, password, nombre, nombre_bodega, direccion } = v.data;
  const origin = (await headers()).get('origin') ?? '';
  const supabase = await createClient();

  // El trigger public.registrar_dueno() crea la bodega y el perfil con rol "dueño"
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, nombre_bodega, direccion },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });

  if (error) return { error: mensajeRegistro(error), valores };

  // Con confirmación de correo activa, Supabase no devuelve error para un correo
  // existente: devuelve un usuario sin identidades.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { error: MSJ_CORREO_REGISTRADO, valores };

  if (!data.session) return { confirmarCorreo: email };

  redirect('/app?bienvenida=1');
}
