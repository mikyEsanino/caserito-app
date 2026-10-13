import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { editarProducto } from '../actions';
import { ProductoForm } from '../producto-form';

export const metadata = { title: 'Editar producto' };

export default async function EditarProducto({ params }: { params: Promise<{ id: string }> }) {
  await requireDueno();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const [{ data: producto }, { data: categorias }] = await Promise.all([
    supabase.from('productos').select('id, nombre, categoria_id, unidad, precio_venta, stock_minimo, activo').eq('id', id).maybeSingle(),
    supabase.from('categorias').select('id, nombre').order('nombre'),
  ]);
  if (!producto) notFound();

  return (
    <>
      <Encabezado titulo="Editar producto" descripcion={producto.nombre} />
      <ProductoForm
        accion={editarProducto.bind(null, id)}
        categorias={categorias ?? []}
        inicial={{
          nombre: producto.nombre,
          categoria_id: producto.categoria_id,
          unidad: producto.unidad,
          precio_venta: Number(producto.precio_venta),
          stock_minimo: Number(producto.stock_minimo),
          activo: producto.activo,
        }}
      />
    </>
  );
}
