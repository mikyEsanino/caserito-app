import { Encabezado } from '@/components/ui';
import { requireContexto } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { hoyLima } from '@/lib/validaciones';
import { ListaStock, type FilaStock, type LoteVista } from './lista-stock';

export const metadata = { title: 'Stock' };

// HU06: stock por producto con detalle de lotes ordenado por vencimiento
export default async function Stock() {
  await requireContexto();
  const supabase = await createClient();
  const [{ data: stock }, { data: lotes }] = await Promise.all([
    supabase
      .from('v_stock')
      .select('producto_id, nombre, categoria, unidad, precio_venta, stock_disponible, stock_vencido, proximo_vencimiento, activo')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('v_lotes')
      .select('id, producto_id, cantidad_inicial, cantidad_actual, fecha_vencimiento, vencido')
      .gt('cantidad_actual', 0)
      .order('fecha_vencimiento', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  const porProducto = new Map<number, LoteVista[]>();
  for (const l of lotes ?? []) {
    const lista = porProducto.get(l.producto_id) ?? [];
    lista.push({ ...l, cantidad_actual: Number(l.cantidad_actual), cantidad_inicial: Number(l.cantidad_inicial) });
    porProducto.set(l.producto_id, lista);
  }

  const filas: FilaStock[] = (stock ?? []).map((p) => ({
    producto_id: p.producto_id,
    nombre: p.nombre,
    categoria: p.categoria,
    unidad: p.unidad,
    precio_venta: Number(p.precio_venta),
    stock_disponible: Number(p.stock_disponible),
    stock_vencido: Number(p.stock_vencido),
    proximo_vencimiento: p.proximo_vencimiento,
    lotes: porProducto.get(p.producto_id) ?? [],
  }));

  return (
    <>
      <Encabezado titulo="Stock" descripcion="Toca un producto para ver sus lotes, del que vence primero al último." />
      <ListaStock filas={filas} hoy={hoyLima()} />
    </>
  );
}
