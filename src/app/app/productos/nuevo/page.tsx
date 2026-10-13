import { Encabezado } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { crearProducto } from '../actions';
import { ProductoForm } from '../producto-form';

export const metadata = { title: 'Nuevo producto' };

export default async function NuevoProducto() {
  await requireDueno();
  const supabase = await createClient();
  const { data: categorias } = await supabase.from('categorias').select('id, nombre').order('nombre');
  return (
    <>
      <Encabezado titulo="Nuevo producto" descripcion="Agrégalo a tu catálogo. El stock se carga después, al ingresar mercadería." />
      <ProductoForm accion={crearProducto} categorias={categorias ?? []} />
    </>
  );
}
