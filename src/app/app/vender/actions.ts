'use server';

import { revalidatePath } from 'next/cache';
import { requireContexto } from '@/lib/contexto';
import { mensajeBD } from '@/lib/errores';
import { createClient } from '@/lib/supabase/server';
import { METODOS_PAGO, validarItemsVenta, type ItemVenta, type MetodoPago } from '@/lib/validaciones';

export type ResultadoVenta =
  | { ok: true; ventaId: number; total: number; totalCobrado: number; metodo: MetodoPago }
  | { ok: false; error: string };

// HU07: la función registrar_venta() descuenta el stock por FEFO en una sola transacción
export async function registrarVenta(items: ItemVenta[], metodoPago: MetodoPago): Promise<ResultadoVenta> {
  await requireContexto();
  const v = validarItemsVenta(items);
  if (!v.ok) return { ok: false, error: Object.values(v.errores)[0] };
  const metodo = METODOS_PAGO.includes(metodoPago) ? metodoPago : 'efectivo';

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('registrar_venta', { p_items: v.data, p_metodo_pago: metodo });
  if (error) return { ok: false, error: mensajeBD(error, 'venta') };

  revalidatePath('/app', 'layout');
  const r = data as { venta_id: number; total: number; total_cobrado: number };
  return { ok: true, ventaId: r.venta_id, total: Number(r.total), totalCobrado: Number(r.total_cobrado), metodo };
}
