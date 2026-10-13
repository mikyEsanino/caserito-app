'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Aviso, Campo } from '@/components/ui';
import { NOMBRE_UNIDAD } from '@/lib/formato';
import { UNIDADES } from '@/lib/validaciones';
import type { EstadoProducto } from './actions';

type Categoria = { id: number; nombre: string };
type Inicial = { nombre: string; categoria_id: number; unidad: string; precio_venta: number; stock_minimo: number; activo: boolean };

export function ProductoForm({
  accion,
  categorias,
  inicial,
}: {
  accion: (prev: EstadoProducto, fd: FormData) => Promise<EstadoProducto>;
  categorias: Categoria[];
  inicial?: Inicial;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoProducto, FormData>(accion, {});
  const e = estado.errores ?? {};
  const v = estado.valores;
  const val = (k: keyof Inicial) => (v ? v[k] : inicial ? String(inicial[k]) : '');

  return (
    <form key={estado.envio ?? 0} action={enviar} className="tarjeta max-w-xl space-y-4" noValidate>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Campo nombre="nombre" etiqueta="Nombre del producto" error={e.nombre}>
        <input id="nombre" name="nombre" className="campo" placeholder="Inca Kola 500 ml" defaultValue={val('nombre')}
          aria-invalid={!!e.nombre} required />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="categoria_id" etiqueta="Categoría" error={e.categoria_id}>
          <select id="categoria_id" name="categoria_id" className="campo" defaultValue={val('categoria_id')} aria-invalid={!!e.categoria_id} required>
            <option value="">Elige…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo nombre="unidad" etiqueta="Se vende por" error={e.unidad}>
          <select id="unidad" name="unidad" className="campo" defaultValue={val('unidad') || 'unidad'} aria-invalid={!!e.unidad} required>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{NOMBRE_UNIDAD[u]}</option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="precio_venta" etiqueta="Precio de venta (S/)" error={e.precio_venta}>
          <input id="precio_venta" name="precio_venta" inputMode="decimal" className="campo" placeholder="3.50"
            defaultValue={val('precio_venta')} aria-invalid={!!e.precio_venta} required />
        </Campo>
        <Campo nombre="stock_minimo" etiqueta="Stock mínimo (opcional)" error={e.stock_minimo} ayuda="Para las alertas de reposición.">
          <input id="stock_minimo" name="stock_minimo" inputMode="decimal" className="campo" placeholder="0"
            defaultValue={val('stock_minimo') === '0' ? '' : val('stock_minimo')} aria-invalid={!!e.stock_minimo} />
        </Campo>
      </div>
      {inicial && (
        <label className="flex items-center gap-3 font-medium">
          <input type="checkbox" name="activo" defaultChecked={v ? v.activo === 'on' : inicial.activo} className="h-5 w-5 accent-marca" />
          Producto activo (se puede vender)
        </label>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar producto'}
        </button>
        <Link href="/app/productos" className="btn btn-secundario">Cancelar</Link>
      </div>
    </form>
  );
}
