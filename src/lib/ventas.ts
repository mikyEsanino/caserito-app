import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetodoPago } from './validaciones';

/**
 * Inicio y fin de un día de Lima como instantes con zona horaria.
 * Perú usa UTC−5 todo el año (no tiene horario de verano).
 */
export function rangoDiaLima(fecha: string): { desde: string; hasta: string } {
  const [y, m, d] = fecha.split('-').map(Number);
  const siguiente = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { desde: `${fecha}T00:00:00-05:00`, hasta: `${siguiente}T00:00:00-05:00` };
}

/** Suma o resta días a una fecha YYYY-MM-DD. */
export function moverDia(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function esFechaValida(fecha: string | undefined): fecha is string {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

const horaLima = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

export type ItemVendido = { nombre: string; cantidad: number; subtotal: number };

export type VentaDelDia = {
  id: number;
  hora: string;
  vendedor: string;
  metodo: MetodoPago;
  total: number;
  totalCobrado: number;
  items: ItemVendido[];
};

export type ResumenDia = {
  cantidad: number;
  totalCobrado: number;
  redondeo: number;
  porMetodo: Partial<Record<MetodoPago, number>>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * HU08: ventas de un día de Lima, de la más reciente a la más antigua, con su resumen.
 * La RLS de "ventas" ya limita los datos a la bodega del usuario.
 */
export async function ventasDelDia(client: SupabaseClient, fecha: string): Promise<{ ventas: VentaDelDia[]; resumen: ResumenDia }> {
  const { desde, hasta } = rangoDiaLima(fecha);
  const { data, error } = await client
    .from('ventas')
    .select('id, total, total_cobrado, metodo_pago, created_at, perfiles ( nombre ), venta_detalle ( cantidad, subtotal, productos ( nombre ) )')
    .gte('created_at', desde)
    .lt('created_at', hasta)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;

  type Fila = {
    id: number;
    total: number;
    total_cobrado: number;
    metodo_pago: MetodoPago;
    created_at: string;
    perfiles: { nombre: string } | null;
    venta_detalle: { cantidad: number; subtotal: number; productos: { nombre: string } | null }[];
  };

  const ventas: VentaDelDia[] = ((data ?? []) as unknown as Fila[]).map((v) => ({
    id: v.id,
    hora: horaLima.format(new Date(v.created_at)),
    vendedor: v.perfiles?.nombre ?? '—',
    metodo: v.metodo_pago,
    total: Number(v.total),
    totalCobrado: Number(v.total_cobrado),
    items: v.venta_detalle
      .map((d) => ({ nombre: d.productos?.nombre ?? '—', cantidad: Number(d.cantidad), subtotal: Number(d.subtotal) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  }));

  const porMetodo: Partial<Record<MetodoPago, number>> = {};
  for (const v of ventas) porMetodo[v.metodo] = r2((porMetodo[v.metodo] ?? 0) + v.totalCobrado);

  return {
    ventas,
    resumen: {
      cantidad: ventas.length,
      totalCobrado: r2(ventas.reduce((s, v) => s + v.totalCobrado, 0)),
      redondeo: r2(ventas.reduce((s, v) => s + (v.total - v.totalCobrado), 0)),
      porMetodo,
    },
  };
}
