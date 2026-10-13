import Link from 'next/link';
import { Encabezado, Insignia } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { cantidad, enSoles, fecha } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';
import { hoyLima } from '@/lib/validaciones';
import { LoteForm } from './lote-form';

export const metadata = { title: 'Ingresar mercadería' };

export default async function Mercaderia() {
  await requireDueno();
  const supabase = await createClient();
  const [{ data: productos }, { data: lotes }] = await Promise.all([
    supabase.from('productos').select('id, nombre, unidad').eq('activo', true).order('nombre'),
    supabase
      .from('lotes')
      .select('id, cantidad_inicial, cantidad_actual, costo_unitario, fecha_vencimiento, created_at, productos ( nombre )')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);
  const hoy = hoyLima();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section>
        <Encabezado titulo="Ingresar mercadería" descripcion="Cada ingreso es un lote con su propia fecha de vencimiento." />
        {productos?.length ? (
          <LoteForm productos={productos} />
        ) : (
          <div className="tarjeta text-suave">
            Primero registra tus productos en{' '}
            <Link href="/app/productos/nuevo" className="font-semibold text-marca underline">Productos</Link>.
          </div>
        )}
      </section>
      <section aria-labelledby="ultimos">
        <h2 id="ultimos" className="mb-3 text-lg font-bold">Últimos ingresos</h2>
        {!lotes?.length ? (
          <p className="text-suave">Todavía no hay lotes registrados.</p>
        ) : (
          <ul className="divide-y divide-linea rounded-2xl border border-linea bg-tarjeta" data-testid="ultimos-lotes">
            {lotes.map((l) => {
              const prod = l.productos as unknown as { nombre: string } | null;
              const vencido = l.fecha_vencimiento < hoy;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{prod?.nombre}</p>
                    <p className="text-sm text-suave">
                      {cantidad(l.cantidad_inicial)} a {enSoles(l.costo_unitario)} c/u · quedan {cantidad(l.cantidad_actual)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p>vence {fecha(l.fecha_vencimiento)}</p>
                    {vencido && <Insignia tono="error">Vencido</Insignia>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
