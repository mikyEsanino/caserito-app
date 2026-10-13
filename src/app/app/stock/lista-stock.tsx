'use client';

import { useMemo, useState } from 'react';
import { Insignia } from '@/components/ui';
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

export function ListaStock({ filas, hoy }: { filas: FilaStock[]; hoy: string }) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? filas.filter((f) => f.nombre.toLowerCase().includes(q) || f.categoria.toLowerCase().includes(q)) : filas;
  }, [busqueda, filas]);

  if (!filas.length) return <div className="tarjeta text-center text-suave">Aún no hay productos registrados.</div>;

  return (
    <div className="space-y-3">
      <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto o categoría…"
        className="campo" aria-label="Buscar producto" />
      <ul className="space-y-2" data-testid="lista-stock">
        {visibles.map((f) => {
          const expandido = abierto === f.producto_id;
          const sinStock = f.stock_disponible <= 0;
          return (
            <li key={f.producto_id} className="overflow-hidden rounded-2xl border border-linea bg-tarjeta" data-testid={`stock-${f.producto_id}`}>
              <button type="button" onClick={() => setAbierto(expandido ? null : f.producto_id)} aria-expanded={expandido}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-papel">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{f.nombre}</span>
                  <span className="text-sm text-suave">
                    {f.categoria} · {enSoles(f.precio_venta)}
                    {f.proximo_vencimiento && ` · vence ${fecha(f.proximo_vencimiento)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-xl font-bold ${sinStock ? 'text-error' : ''}`} data-testid="stock-total">
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
                            <tr key={l.id} className="border-t border-linea/70">
                              <td className="py-1.5">#{l.id}</td>
                              <td className="py-1.5">
                                {fecha(l.fecha_vencimiento)}{' '}
                                {l.vencido ? (
                                  <Insignia tono="error">Vencido · no se vende</Insignia>
                                ) : dias <= 7 ? (
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
      {visibles.length === 0 && <p className="text-center text-suave">No hay productos que coincidan con “{busqueda}”.</p>}
    </div>
  );
}
