import Link from 'next/link';
import { Encabezado, Insignia } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { cantidad, enSoles, fecha as fmtFecha, NOMBRE_METODO } from '@/lib/formato';
import { createClient } from '@/lib/supabase/server';
import { hoyLima, METODOS_PAGO } from '@/lib/validaciones';
import { esFechaValida, moverDia, ventasDelDia } from '@/lib/ventas';

export const metadata = { title: 'Ventas del día' };

// HU08: historial de ventas del día (solo el dueño)
export default async function Ventas({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  await requireDueno();
  const hoy = hoyLima();
  const pedida = (await searchParams).fecha;
  const dia = esFechaValida(pedida) && pedida <= hoy ? pedida : hoy;
  const esHoy = dia === hoy;

  const supabase = await createClient();
  const { ventas, resumen } = await ventasDelDia(supabase, dia);

  return (
    <>
      <Encabezado
        titulo={esHoy ? 'Ventas de hoy' : `Ventas del ${fmtFecha(dia)}`}
        descripcion="Cada venta con su hora, productos, quién la registró y el total cobrado."
      />

      <nav aria-label="Cambiar de día" className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/app/ventas?fecha=${moverDia(dia, -1)}`} className="btn btn-secundario">← Día anterior</Link>
        <span className="px-2 font-semibold" data-testid="dia-ventas">{fmtFecha(dia)}</span>
        {!esHoy && (
          <>
            <Link href={`/app/ventas?fecha=${moverDia(dia, 1)}`} className="btn btn-secundario">Día siguiente →</Link>
            <Link href="/app/ventas" className="btn btn-secundario">Hoy</Link>
          </>
        )}
      </nav>

      <section aria-label="Resumen del día" className="mb-6 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="tarjeta">
          <p className="text-sm font-semibold uppercase tracking-wide text-suave">Total vendido</p>
          <p className="text-4xl font-bold text-marca" data-testid="total-dia">{enSoles(resumen.totalCobrado)}</p>
          <p className="mt-1 text-suave" data-testid="cantidad-ventas">
            {resumen.cantidad} venta{resumen.cantidad === 1 ? '' : 's'}
            {resumen.redondeo > 0 && ` · ${enSoles(resumen.redondeo)} de redondeo a favor de los clientes`}
          </p>
        </div>
        <div className="tarjeta">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Por método de pago</p>
          {resumen.cantidad === 0 ? (
            <p className="text-suave">Sin ventas.</p>
          ) : (
            <ul className="space-y-1" data-testid="por-metodo">
              {METODOS_PAGO.filter((m) => resumen.porMetodo[m] !== undefined).map((m) => (
                <li key={m} className="flex justify-between">
                  <span>{NOMBRE_METODO[m]}</span>
                  <span className="font-semibold">{enSoles(resumen.porMetodo[m]!)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {ventas.length === 0 ? (
        <div className="tarjeta text-center text-suave">No hay ventas registradas este día.</div>
      ) : (
        <ul className="space-y-2" data-testid="lista-ventas">
          {ventas.map((v) => (
            <li key={v.id} className="rounded-2xl border border-linea bg-tarjeta px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{v.hora}</span>
                  <span className="text-suave">· {v.vendedor}</span>
                  <Insignia tono="neutro">{NOMBRE_METODO[v.metodo]}</Insignia>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">{enSoles(v.totalCobrado)}</span>
                  {v.total !== v.totalCobrado && (
                    <span className="block text-xs text-suave">exacto {enSoles(v.total)}</span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-suave">
                {v.items.map((i) => `${cantidad(i.cantidad)} × ${i.nombre}`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
