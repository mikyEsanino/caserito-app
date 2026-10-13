'use client';

import { useActionState, useState } from 'react';
import { Aviso, Campo } from '@/components/ui';
import { NOMBRE_UNIDAD } from '@/lib/formato';
import { hoyLima, unidadFraccionable } from '@/lib/validaciones';
import { registrarLote, type EstadoLote } from './actions';

type Producto = { id: number; nombre: string; unidad: string };

export function LoteForm({ productos }: { productos: Producto[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoLote, FormData>(registrarLote, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};
  const [productoId, setProductoId] = useState(v.producto_id ?? '');
  const unidad = productos.find((p) => String(p.id) === productoId)?.unidad;

  return (
    // key: se vuelve a montar en cada respuesta (limpio tras guardar; con lo escrito si hubo error)
    <form key={estado.envio ?? 0} action={enviar} className="tarjeta space-y-4" noValidate>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.exito && <Aviso tipo="bien">{estado.exito}</Aviso>}
      <Campo nombre="producto_id" etiqueta="Producto" error={e.producto_id}>
        <select id="producto_id" name="producto_id" className="campo" defaultValue={v.producto_id ?? ''}
          onChange={(ev) => setProductoId(ev.target.value)} aria-invalid={!!e.producto_id} required>
          <option value="">Elige un producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} (por {NOMBRE_UNIDAD[p.unidad] ?? p.unidad})</option>
          ))}
        </select>
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="cantidad" etiqueta={`Cantidad${unidad ? ` (${NOMBRE_UNIDAD[unidad] ?? unidad})` : ''}`} error={e.cantidad}
          ayuda={unidad && !unidadFraccionable(unidad) ? 'Número entero.' : undefined}>
          <input id="cantidad" name="cantidad" inputMode={unidad && unidadFraccionable(unidad) ? 'decimal' : 'numeric'} className="campo"
            placeholder="24" defaultValue={v.cantidad} aria-invalid={!!e.cantidad} required />
        </Campo>
        <Campo nombre="costo_unitario" etiqueta="Costo por unidad (S/)" error={e.costo_unitario} ayuda="Lo que te cobró el distribuidor.">
          <input id="costo_unitario" name="costo_unitario" inputMode="decimal" className="campo" placeholder="2.10"
            defaultValue={v.costo_unitario} aria-invalid={!!e.costo_unitario} required />
        </Campo>
      </div>
      <Campo nombre="fecha_vencimiento" etiqueta="Fecha de vencimiento" error={e.fecha_vencimiento}>
        <input id="fecha_vencimiento" name="fecha_vencimiento" type="date" className="campo" min={hoyLima()}
          defaultValue={v.fecha_vencimiento} aria-invalid={!!e.fecha_vencimiento} required />
      </Campo>
      <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Agregar al inventario'}
      </button>
    </form>
  );
}
