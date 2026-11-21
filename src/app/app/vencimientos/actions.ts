'use server';

import { revalidatePath } from 'next/cache';
import { requireDueno } from '@/lib/contexto';
import { mensajeBD } from '@/lib/errores';
import { cantidad, enSoles } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';
import { validarDiasAviso } from '@/lib/validaciones';

export type EstadoDias = { error?: string; exito?: string; errores?: Record<string, string>; valor?: string; envio?: number };

// HU13 CA1: el dueño elige con cuántos días de anticipación quiere ver los lotes por vencer
export async function guardarDiasAviso(prev: EstadoDias, fd: FormData): Promise<EstadoDias> {
  const ctx = await requireDueno();
  const envio = (prev.envio ?? 0) + 1;
  const valor = String(fd.get('dias_aviso') ?? '');
  const v = validarDiasAviso(fd);
  if (!v.ok) return { errores: v.errores, valor, envio };

  const supabase = await createClient();
  const { data, error } = await supabase.from('bodegas').update(v.data).eq('id', ctx.bodegaId).select('id');
  if (error || !data?.length) return { error: 'No se pudo guardar. Inténtalo de nuevo.', valor, envio };

  revalidatePath('/app', 'layout');
  const n = v.data.dias_aviso_vencimiento;
  return { exito: `Listo: verás los lotes que vencen en los próximos ${n} día${n === 1 ? '' : 's'}.`, envio };
}

export type EstadoMerma = { error?: string; exito?: string };

// HU13 CA2: dar de baja un lote vencido como merma
export async function registrarMerma(_prev: EstadoMerma, fd: FormData): Promise<EstadoMerma> {
  await requireDueno();
  const loteId = Number(fd.get('lote_id'));
  const producto = String(fd.get('producto') ?? 'el producto');
  if (!Number.isInteger(loteId) || loteId <= 0) return { error: 'El lote elegido no es válido.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('registrar_merma', { p_lote_id: loteId });
  if (error) return { error: mensajeBD(error, 'merma') };

  revalidatePath('/app', 'layout');
  const r = data as { cantidad: number; costo_total: number };
  return { exito: `Merma registrada: ${cantidad(r.cantidad)} de "${producto}", ${enSoles(r.costo_total)} a precio de costo.` };
}
