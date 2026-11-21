import { Encabezado, Insignia } from '@/components/ui';
import { lotePorVencer } from '@/lib/alertas';
import { requireDueno } from '@/lib/contexto';
import { cantidad, diasHasta, enSoles, fecha, NOMBRE_UNIDAD } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';
import { hoyLima } from '@/lib/validaciones';
import { moverDia, rangoDiaLima } from '@/lib/ventas';
import { DiasAvisoForm, ListaVencidos, type LoteVencido } from './formularios';

export const metadata = { title: 'Vencimientos' };

type Producto = { nombre: string; unidad: string } | null;

// HU13: lotes por vencer (para ponerlos en oferta) y lotes vencidos (para registrarlos como merma)
export default async function Vencimientos() {
  const ctx = await requireDueno();
  const hoy = hoyLima();
  const dias = ctx.diasAviso;
  const supabase = await createClient();

  const [{ data: lotes }, { data: mermas }] = await Promise.all([
    supabase
      .from('lotes')
      .select('id, cantidad_actual, costo_unitario, fecha_vencimiento, productos ( nombre, unidad )')
      .gt('cantidad_actual', 0)
      .lte('fecha_vencimiento', moverDia(hoy, dias))
      .order('fecha_vencimiento', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('mermas')
      .select('id, cantidad, costo_total, created_at, productos ( nombre, unidad )')
      .gte('created_at', rangoDiaLima(moverDia(hoy, -29)).desde)
      .order('created_at', { ascending: false }),
  ]);

  const filas = (lotes ?? []).map((l) => {
    const p = l.productos as unknown as Producto;
    return {
      id: l.id as number,
      producto: p?.nombre ?? '—',
      unidad: p?.unidad ?? '',
      cantidad_actual: Number(l.cantidad_actual),
      costo_unitario: Number(l.costo_unitario),
      fecha_vencimiento: l.fecha_vencimiento as string,
    };
  });
  const porVencer = filas.filter((l) => lotePorVencer(l, hoy, dias));
  const vencidos: LoteVencido[] = filas
    .filter((l) => l.fecha_vencimiento < hoy)
    .map((l) => ({ ...l, dias_vencido: -diasHasta(l.fecha_vencimiento, hoy) }));

  const listaMermas = (mermas ?? []).map((m) => {
    const p = m.productos as unknown as Producto;
    return { id: m.id as number, producto: p?.nombre ?? '—', unidad: p?.unidad ?? '', cantidad: Number(m.cantidad), costo: Number(m.costo_total), creada: m.created_at as string };
  });
  const perdida = listaMermas.reduce((s, m) => s + m.costo, 0);
  const fechaLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

  return (
    <div className="space-y-8">
      <Encabezado titulo="Vencimientos" descripcion="Pon en oferta lo que está por vencer y da de baja lo que ya venció." />

      <DiasAvisoForm dias={dias} />

      <section aria-labelledby="titulo-por-vencer" className="space-y-3">
        <h2 id="titulo-por-vencer" className="text-lg font-bold">
          Por vencer en los próximos {dias} día{dias === 1 ? '' : 's'} <span className="text-suave">({porVencer.length})</span>
        </h2>
        {porVencer.length === 0 ? (
          <p className="tarjeta text-center text-suave">Ningún lote vence en los próximos {dias} días.</p>
        ) : (
          <ul className="space-y-2" data-testid="lotes-por-vencer">
            {porVencer.map((l) => {
              const d = diasHasta(l.fecha_vencimiento, hoy);
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl border border-alerta/40 bg-tarjeta px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{l.producto}</p>
                    <p className="text-sm text-suave">
                      Lote #{l.id} · vence el {fecha(l.fecha_vencimiento)}{' '}
                      <Insignia tono="alerta">{d === 0 ? 'vence hoy' : `en ${d} día${d === 1 ? '' : 's'}`}</Insignia>
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-xl font-bold">{cantidad(l.cantidad_actual)}</span>
                    <span className="text-xs text-suave">{NOMBRE_UNIDAD[l.unidad] ?? l.unidad}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-vencidos" className="space-y-3">
        <h2 id="titulo-vencidos" className="text-lg font-bold">
          Vencidos <span className="text-suave">({vencidos.length})</span>
        </h2>
        <p className="text-sm text-suave">No se pueden vender. Al registrarlos como merma salen del inventario y se guarda cuánto se perdió.</p>
        <ListaVencidos lotes={vencidos} />
      </section>

      <section aria-labelledby="titulo-mermas" className="space-y-3">
        <h2 id="titulo-mermas" className="text-lg font-bold">Mermas de los últimos 30 días</h2>
        {listaMermas.length === 0 ? (
          <p className="tarjeta text-center text-suave">Aún no hay mermas registradas.</p>
        ) : (
          <div className="tarjeta space-y-3">
            <p>
              Pérdida a precio de costo: <span className="text-xl font-bold text-error" data-testid="perdida-mermas">{enSoles(perdida)}</span>
            </p>
            <ul className="divide-y divide-linea" data-testid="mermas">
              {listaMermas.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{m.producto}</span>{' '}
                    <span className="text-sm text-suave">· {fecha(fechaLima.format(new Date(m.creada)))}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {cantidad(m.cantidad)} {NOMBRE_UNIDAD[m.unidad] ?? m.unidad} · {enSoles(m.costo)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
