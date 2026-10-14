'use client';

import { useMemo, useState } from 'react';
import { Insignia } from '@/components/ui';
import { cumpleFiltro, DIAS_POR_VENCER, porVencer, sinStock, tieneVencidos, type FiltroStock } from '@/lib/alertas';
import { cantidad, diasHasta, enSoles, fecha, NOMBRE_UNIDAD } from '@/lib/formato';

export type LoteVista = {
  id: number;
  producto_id: number;
  cantidad_inicial: number;
  cantidad_actual: number;
  fecha_vencimiento: string;
  vencido: boolean;
};

export type FilaStock = {
  producto_id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  precio_venta: number;
  stock_disponible: number;
  stock_vencido: number;
  proximo_vencimiento: string | null;
  lotes: LoteVista[];
};

const ETIQUETAS: Record<FiltroStock, string> = {
  todos: 'Todos',
  vencidos: 'Vencidos',
  'por-vencer': `Por vencer (${DIAS_POR_VENCER} días)`,
  'sin-stock': 'Sin stock',
};

function textoDias(dias: number) {
  return dias === 0 ? 'vence hoy' : `vence en ${dias} día${dias === 1 ? '' : 's'}`;
}

export function ListaStock({ filas, hoy, filtroInicial = 'todos' }: { filas: FilaStock[]; hoy: string; filtroInicial?: FiltroStock }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroStock>(filtroInicial);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const conteo = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(ETIQUETAS) as FiltroStock[]).map((f) => [f, filas.filter((p) => cumpleFiltro(p, f, hoy)).length]),
      ) as Record<FiltroStock, number>,
    [filas, hoy],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => cumpleFiltro(f, filtro, hoy))
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.categoria.toLowerCase().includes(q));
  }, [busqueda, filas, filtro, hoy]);

  // En los filtros de vencimiento el detalle de lotes se muestra abierto: se ve de inmediato cuál es
  const expandirTodo = filtro === 'vencidos' || filtro === 'por-vencer';

  function cambiarFiltro(f: FiltroStock) {
    setFiltro(f);
    setAbiertos(new Set());
    try {
      window.history.replaceState(null, '', f === 'todos' ? '/app/stock' : `/app/stock?filtro=${f}`);
    } catch {
      // sin historial disponible: el filtro igual funciona
    }
  }

  function alternar(id: number) {
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  if (!filas.length) return <div className="tarjeta text-center text-suave">Aún no hay productos registrados.</div>;

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar productos" className="flex flex-wrap gap-2">
        {(Object.keys(ETIQUETAS) as FiltroStock[]).map((f) => {
          const activo = filtro === f;
          const alerta = f !== 'todos' && conteo[f] > 0;
          return (
            <button key={f} type="button" onClick={() => cambiarFiltro(f)} aria-pressed={activo}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                activo ? 'border-marca bg-marca text-white' : 'border-linea bg-tarjeta text-tinta hover:border-marca'
              }`}>
              {ETIQUETAS[f]}{' '}
              <span className={activo ? 'text-white/85' : alerta ? (f === 'por-vencer' ? 'text-alerta' : 'text-error') : 'text-suave'}>
                ({conteo[f]})
              </span>
            </button>
          );
        })}
      </div>

      <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto o categoría…"
        className="campo" aria-label="Buscar producto" />

      <ul className="space-y-2" data-testid="lista-stock">
        {visibles.map((f) => {
          const expandido = expandirTodo || abiertos.has(f.producto_id);
          const agotado = sinStock(f);
          const vencidos = tieneVencidos(f);
          const pronto = porVencer(f, hoy);
          return (
            <li key={f.producto_id} data-testid={`stock-${f.producto_id}`}
              className={`overflow-hidden rounded-2xl border bg-tarjeta ${vencidos ? 'border-error/40' : pronto ? 'border-alerta/40' : 'border-linea'}`}>
              <button type="button" onClick={() => alternar(f.producto_id)} aria-expanded={expandido}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-papel">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{f.nombre}</span>
                  <span className="text-sm text-suave">
                    {f.categoria} · {enSoles(f.precio_venta)}
                    {f.proximo_vencimiento && ` · vence ${fecha(f.proximo_vencimiento)}`}
                  </span>
                  {(vencidos || pronto || agotado) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5" data-testid="alertas-producto">
                      {vencidos && <Insignia tono="error">{cantidad(f.stock_vencido)} vencido{f.stock_vencido === 1 ? '' : 's'}</Insignia>}
                      {pronto && f.proximo_vencimiento && <Insignia tono="alerta">{textoDias(diasHasta(f.proximo_vencimiento, hoy))}</Insignia>}
                      {agotado && <Insignia tono="error">Sin stock</Insignia>}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-xl font-bold ${agotado ? 'text-error' : ''}`} data-testid="stock-total">
                    {cantidad(f.stock_disponible)}
                  </span>
                  <span className="text-xs text-suave">{NOMBRE_UNIDAD[f.unidad] ?? f.unidad}</span>
                </span>
              </button>
              {expandido && (
                <div className="border-t border-linea bg-papel/60 px-4 py-3">
                  {f.lotes.length === 0 ? (
                    <p className="text-sm text-suave">No hay lotes con stock.</p>
                  ) : (
                    <table className="w-full text-sm" data-testid="tabla-lotes">
                      <thead>
                        <tr className="text-left text-suave">
                          <th className="py-1 font-semibold">Lote</th>
                          <th className="py-1 font-semibold">Vence</th>
                          <th className="py-1 text-right font-semibold">Quedan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.lotes.map((l) => {
                          const dias = diasHasta(l.fecha_vencimiento, hoy);
                          return (
                            <tr key={l.id} className={`border-t border-linea/70 ${l.vencido ? 'bg-error-claro/60' : ''}`}>
                              <td className="py-1.5">#{l.id}</td>
                              <td className="py-1.5">
                                {fecha(l.fecha_vencimiento)}{' '}
                                {l.vencido ? (
                                  <Insignia tono="error">Vencido · no se vende</Insignia>
                                ) : dias <= DIAS_POR_VENCER ? (
                                  <Insignia tono="alerta">{dias === 0 ? 'vence hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}</Insignia>
                                ) : null}
                              </td>
                              <td className="py-1.5 text-right font-semibold">
                                {cantidad(l.cantidad_actual)} <span className="font-normal text-suave">de {cantidad(l.cantidad_inicial)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {f.stock_vencido > 0 && (
                    <p className="mt-2 text-sm text-error">{cantidad(f.stock_vencido)} vencido(s) no se cuentan en el stock disponible.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {visibles.length === 0 && (
        <p className="tarjeta text-center text-suave">
          {busqueda ? `No hay productos que coincidan con “${busqueda}”.` : `No hay productos en “${ETIQUETAS[filtro]}”. ¡Todo en orden!`}
        </p>
      )}
    </div>
  );
}
