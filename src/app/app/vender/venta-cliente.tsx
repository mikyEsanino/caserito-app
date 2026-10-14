'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Aviso } from '@/components/ui';
import { totalACobrar } from '@/lib/dinero';
import { cantidad as fmtCant, enSoles, NOMBRE_METODO, NOMBRE_UNIDAD } from '@/lib/formato';
import { METODOS_PAGO, unidadFraccionable, type MetodoPago } from '@/lib/validaciones';
import { registrarVenta } from './actions';

export type ProductoVenta = { id: number; nombre: string; unidad: string; precio: number; stock: number; categoria: string };
type Linea = { producto: ProductoVenta; cantidad: string };

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}

export function VentaCliente({ productos }: { productos: ProductoVenta[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [ultima, setUltima] = useState<{ ventaId: number; totalCobrado: number; metodo: MetodoPago } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? productos.filter((p) => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)) : productos;
  }, [busqueda, productos]);

  const detalle = lineas.map((linea) => {
    // Usa el stock más reciente (se actualiza tras router.refresh())
    const l = { ...linea, producto: productos.find((p) => p.id === linea.producto.id) ?? linea.producto };
    const cant = Number(l.cantidad.replace(',', '.'));
    const valida = Number.isFinite(cant) && cant > 0 && (unidadFraccionable(l.producto.unidad) || Number.isInteger(cant));
    const excede = valida && cant > l.producto.stock;
    return { ...l, cant, valida, excede, subtotal: valida ? redondear(cant * l.producto.precio) : 0 };
  });
  const total = redondear(detalle.reduce((s, d) => s + d.subtotal, 0));
  const aCobrar = totalACobrar(total, metodo);
  const redondeo = redondear(total - aCobrar);
  const hayProblemas = detalle.some((d) => !d.valida || d.excede);

  function agregar(p: ProductoVenta) {
    setUltima(null);
    setError(null);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.producto.id === p.id);
      if (i === -1) return [...ls, { producto: p, cantidad: '1' }];
      const actual = Number(ls[i].cantidad.replace(',', '.')) || 0;
      return ls.map((l, j) => (j === i ? { ...l, cantidad: String(Math.min(actual + 1, p.stock)) } : l));
    });
  }

  function cambiar(id: number, cantidad: string) {
    setLineas((ls) => ls.map((l) => (l.producto.id === id ? { ...l, cantidad } : l)));
  }

  function paso(id: number, delta: number) {
    setLineas((ls) =>
      ls.flatMap((l) => {
        if (l.producto.id !== id) return [l];
        const nueva = redondear((Number(l.cantidad.replace(',', '.')) || 0) + delta);
        return nueva <= 0 ? [] : [{ ...l, cantidad: String(Math.min(nueva, l.producto.stock)) }];
      }),
    );
  }

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await registrarVenta(
        detalle.map((d) => ({ producto_id: d.producto.id, cantidad: d.cant })),
        metodo,
      );
      if (!r.ok) {
        setError(r.error);
        router.refresh();
        return;
      }
      setUltima({ ventaId: r.ventaId, totalCobrado: r.totalCobrado, metodo: r.metodo });
      setLineas([]);
      setMetodo('efectivo');
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[1fr_380px] lg:pb-0">
      <section aria-label="Productos">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…"
          className="campo mb-3" aria-label="Buscar producto" />
        {productos.length === 0 ? (
          <div className="tarjeta text-suave">No hay productos activos. El dueño debe registrarlos primero.</div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="catalogo-venta">
            {visibles.map((p) => {
              const agotado = p.stock <= 0;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => agregar(p)} disabled={agotado}
                    className="flex h-full w-full flex-col justify-between rounded-2xl border border-linea bg-tarjeta p-3 text-left hover:border-marca disabled:opacity-50"
                    aria-label={`Agregar ${p.nombre}`}>
                    <span className="font-semibold leading-snug">{p.nombre}</span>
                    <span className="mt-2 flex items-end justify-between gap-1">
                      <span className="text-lg font-bold text-marca">{enSoles(p.precio)}</span>
                      <span className={`text-xs ${agotado ? 'font-bold text-error' : 'text-suave'}`}>
                        {agotado ? 'Agotado' : `${fmtCant(p.stock)} ${NOMBRE_UNIDAD[p.unidad] ?? p.unidad}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detalle.length > 0 && (
        // En el celular el carrito queda debajo: esta barra lleva hasta él
        <a href="#venta-actual" className="fixed inset-x-4 bottom-20 z-10 flex items-center justify-between rounded-2xl bg-tinta px-5 py-3 font-semibold text-white shadow-lg lg:hidden">
          <span>{detalle.length} producto{detalle.length === 1 ? '' : 's'} · {enSoles(aCobrar)}</span>
          <span>Ver venta ↓</span>
        </a>
      )}

      <section id="venta-actual" aria-label="Venta actual" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
        <div className="tarjeta space-y-4">
          <h2 className="text-lg font-bold">Venta actual</h2>
          {ultima && (
            <Aviso tipo="bien">
              <span data-testid="venta-ok">
                Venta #{ultima.ventaId} registrada · Cobrado {enSoles(ultima.totalCobrado)} ({NOMBRE_METODO[ultima.metodo]})
              </span>
            </Aviso>
          )}
          {error && <Aviso tipo="error"><span data-testid="venta-error">{error}</span></Aviso>}

          {detalle.length === 0 ? (
            <p className="text-suave">Toca un producto para agregarlo.</p>
          ) : (
            <ul className="divide-y divide-linea" data-testid="carrito">
              {detalle.map((d) => (
                <li key={d.producto.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{d.producto.nombre}</span>
                    <span className="font-bold">{enSoles(d.subtotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="h-10 w-10 rounded-lg border border-linea text-xl font-bold" onClick={() => paso(d.producto.id, -1)}
                      aria-label={`Quitar uno de ${d.producto.nombre}`}>−</button>
                    <input value={d.cantidad} onChange={(e) => cambiar(d.producto.id, e.target.value)}
                      inputMode={unidadFraccionable(d.producto.unidad) ? 'decimal' : 'numeric'}
                      className="h-10 w-20 rounded-lg border border-linea text-center font-semibold" aria-label={`Cantidad de ${d.producto.nombre}`} />
                    <button type="button" className="h-10 w-10 rounded-lg border border-linea text-xl font-bold" onClick={() => paso(d.producto.id, 1)}
                      aria-label={`Agregar uno de ${d.producto.nombre}`} disabled={d.valida && d.cant >= d.producto.stock}>+</button>
                    <span className="text-sm text-suave">× {enSoles(d.producto.precio)}</span>
                  </div>
                  {!d.valida && <p className="mt-1 text-sm text-error">Cantidad inválida{unidadFraccionable(d.producto.unidad) ? '' : ' (usa un número entero)'}.</p>}
                  {d.excede && <p className="mt-1 text-sm text-error">Solo hay {fmtCant(d.producto.stock)} disponibles.</p>}
                </li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="metodo" className="etiqueta">Método de pago</label>
            <select id="metodo" className="campo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>{NOMBRE_METODO[m]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 border-t border-linea pt-3">
            {redondeo > 0 && (
              <>
                <div className="flex items-center justify-between text-suave">
                  <span>Subtotal</span>
                  <span data-testid="venta-subtotal">{enSoles(total)}</span>
                </div>
                <div className="flex items-center justify-between text-bien" title="Art. 44 del Código de Protección y Defensa del Consumidor">
                  <span>Redondeo a favor del cliente</span>
                  <span data-testid="venta-redondeo">−{enSoles(redondeo)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-xl font-bold">
              <span>{metodo === 'efectivo' ? 'A cobrar' : 'Total'}</span>
              <span data-testid="venta-total">{enSoles(aCobrar)}</span>
            </div>
          </div>
          <button type="button" className="btn btn-primario w-full text-lg" onClick={confirmar}
            disabled={pendiente || detalle.length === 0 || hayProblemas}>
            {pendiente ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </div>
      </section>
    </div>
  );
}
