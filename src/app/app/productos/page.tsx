import Link from 'next/link';
import { Aviso, Encabezado, Insignia } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { cantidad, enSoles, NOMBRE_UNIDAD } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Productos' };

const MENSAJES: Record<string, string> = { creado: 'Producto registrado.', editado: 'Producto actualizado.' };

export default async function Productos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireDueno();
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: productos } = await supabase
    .from('v_stock')
    .select('producto_id, nombre, categoria, unidad, precio_venta, stock_disponible, activo')
    .order('nombre');

  return (
    <>
      <Encabezado
        titulo="Productos"
        descripcion="Tu catálogo y precios de venta."
        accion={<Link href="/app/productos/nuevo" className="btn btn-primario">+ Nuevo producto</Link>}
      />
      {ok && MENSAJES[ok] && <div className="mb-4"><Aviso tipo="bien">{MENSAJES[ok]}</Aviso></div>}
      {!productos?.length ? (
        <div className="tarjeta text-center text-suave">Aún no tienes productos. Registra el primero.</div>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-tarjeta" data-testid="lista-productos">
          {productos.map((p) => (
            <li key={p.producto_id}>
              <Link href={`/app/productos/${p.producto_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-papel">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.nombre}</p>
                  <p className="text-sm text-suave">
                    {p.categoria} · por {NOMBRE_UNIDAD[p.unidad] ?? p.unidad} · stock {cantidad(p.stock_disponible)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-bold">{enSoles(p.precio_venta)}</span>
                  {!p.activo && <Insignia tono="neutro">Inactivo</Insignia>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
