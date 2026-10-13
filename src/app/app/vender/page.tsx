import { Encabezado } from '@/components/ui';
import { requireContexto } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { VentaCliente, type ProductoVenta } from './venta-cliente';

export const metadata = { title: 'Vender' };

export default async function Vender() {
  await requireContexto();
  const supabase = await createClient();
  const { data } = await supabase
    .from('v_stock')
    .select('producto_id, nombre, unidad, precio_venta, stock_disponible, categoria')
    .eq('activo', true)
    .order('nombre');

  const productos: ProductoVenta[] = (data ?? []).map((p) => ({
    id: p.producto_id,
    nombre: p.nombre,
    unidad: p.unidad,
    precio: Number(p.precio_venta),
    stock: Number(p.stock_disponible),
    categoria: p.categoria,
  }));

  return (
    <>
      <Encabezado titulo="Registrar venta" descripcion="El stock se descuenta del lote que vence primero." />
      <VentaCliente productos={productos} />
    </>
  );
}
