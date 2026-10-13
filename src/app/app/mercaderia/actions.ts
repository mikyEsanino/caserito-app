'use server';

import { revalidatePath } from 'next/cache';
import { requireDueno } from '@/lib/contexto';
import { mensajeBD } from '@/lib/errores';
import { cantidad } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';
import { validarLote } from '@/lib/validaciones';

export type EstadoLote = {
  error?: string;
  exito?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  envio?: number;
};

// HU05: registrar ingreso de mercadería por lote
export async function registrarLote(prev: EstadoLote, fd: FormData): Promise<EstadoLote> {
  await requireDueno();
  const envio = (prev.envio ?? 0) + 1;
  const valores = {
    producto_id: String(fd.get('producto_id') ?? ''),
    cantidad: String(fd.get('cantidad') ?? ''),
    costo_unitario: String(fd.get('costo_unitario') ?? ''),
    fecha_vencimiento: String(fd.get('fecha_vencimiento') ?? ''),
  };
  const supabase = await createClient();

  const productoId = Number(valores.producto_id);
  const { data: producto } = Number.isInteger(productoId) && productoId > 0
    ? await supabase.from('productos').select('id, nombre, unidad').eq('id', productoId).maybeSingle()
    : { data: null };

  const v = validarLote(fd, producto?.unidad ?? null);
  if (!v.ok) return { errores: v.errores, valores, envio };

  const { error } = await supabase.from('lotes').insert(v.data);
  if (error) return { error: mensajeBD(error, 'lote'), valores, envio };

  revalidatePath('/app', 'layout');
  return {
    exito: `Se agregaron ${cantidad(v.data.cantidad_inicial)} de "${producto!.nombre}" al inventario.`,
    envio,
  };
}
