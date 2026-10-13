'use server';

import { revalidatePath } from 'next/cache';
import { crearAyudante } from '@/lib/ayudantes';
import { requireDueno } from '@/lib/contexto';
import { createAdminClient } from '@/lib/supabase/admin';
import { validarAyudante } from '@/lib/validaciones';

export type EstadoAyudante = {
  error?: string;
  exito?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  envio?: number;
};

// HU03: el dueño crea la cuenta de su ayudante (rol con permisos limitados)
export async function registrarAyudante(prev: EstadoAyudante, fd: FormData): Promise<EstadoAyudante> {
  const ctx = await requireDueno();
  const valores = { nombre: String(fd.get('nombre') ?? ''), email: String(fd.get('email') ?? '') };
  const v = validarAyudante(fd);
  if (!v.ok) return { errores: v.errores, valores, envio: (prev.envio ?? 0) + 1 };

  const r = await crearAyudante(createAdminClient(), ctx.bodegaId, v.data);
  if (!r.ok) return { error: r.error, valores, envio: (prev.envio ?? 0) + 1 };

  revalidatePath('/app/equipo');
  return {
    exito: `Listo. ${v.data.nombre} ya puede ingresar con ${v.data.email} y la contraseña temporal que le diste.`,
    envio: (prev.envio ?? 0) + 1,
  };
}
