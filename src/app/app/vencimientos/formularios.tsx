'use client';

import { useActionState } from 'react';
import { Aviso, Insignia } from '@/components/ui';
import { cantidad, enSoles, fecha, NOMBRE_UNIDAD } from '@/lib/formato';
import { DIAS_AVISO_LIMITES } from '@/lib/validaciones';
import { guardarDiasAviso, registrarMerma, type EstadoDias, type EstadoMerma } from './actions';

export function DiasAvisoForm({ dias }: { dias: number }) {
  const [estado, enviar, enviando] = useActionState<EstadoDias, FormData>(guardarDiasAviso, {});
  const error = estado.errores?.dias_aviso;
  return (
    <form key={estado.envio ?? 0} action={enviar} className="tarjeta space-y-3" noValidate>
      {estado.exito && <Aviso tipo="bien">{estado.exito}</Aviso>}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="dias_aviso" className="etiqueta">Avisarme con estos días de anticipación</label>
          <input id="dias_aviso" name="dias_aviso" inputMode="numeric" className="campo w-28"
            defaultValue={estado.valor ?? String(dias)} aria-invalid={!!error} aria-describedby={error ? 'dias_aviso-error' : undefined} />
        </div>
        <button type="submit" className="btn btn-secundario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {error ? (
        <p id="dias_aviso-error" role="alert" className="text-sm font-medium text-error">{error}</p>
      ) : (
        <p className="text-sm text-suave">Entre {DIAS_AVISO_LIMITES.min} y {DIAS_AVISO_LIMITES.max} días. Se aplica también en Inicio y en Stock.</p>
      )}
    </form>
  );
}

export type LoteVencido = {
  id: number;
  producto: string;
  unidad: string;
  cantidad_actual: number;
  costo_unitario: number;
  fecha_vencimiento: string;
  dias_vencido: number;
};

export function ListaVencidos({ lotes }: { lotes: LoteVencido[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoMerma, FormData>(registrarMerma, {});
  return (
    <div className="space-y-3">
      {estado.exito && <Aviso tipo="bien">{estado.exito}</Aviso>}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {lotes.length === 0 ? (
        <p className="tarjeta text-center text-suave">No hay lotes vencidos con unidades. ¡Todo en orden!</p>
      ) : (
        <ul className="space-y-2" data-testid="lotes-vencidos">
          {lotes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/40 bg-tarjeta px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{l.producto}</p>
                <p className="text-sm text-suave">
                  Lote #{l.id} · venció el {fecha(l.fecha_vencimiento)}{' '}
                  <Insignia tono="error">{l.dias_vencido === 1 ? 'hace 1 día' : `hace ${l.dias_vencido} días`}</Insignia>
                </p>
                <p className="text-sm">
                  <span className="font-semibold">{cantidad(l.cantidad_actual)} {NOMBRE_UNIDAD[l.unidad] ?? l.unidad}</span>
                  <span className="text-suave"> · {enSoles(l.cantidad_actual * l.costo_unitario)} a precio de costo</span>
                </p>
              </div>
              <form action={enviar}>
                <input type="hidden" name="lote_id" value={l.id} />
                <input type="hidden" name="producto" value={l.producto} />
                <button type="submit" className="btn btn-secundario" disabled={enviando} aria-label={`Registrar merma de ${l.producto}, lote ${l.id}`}>
                  Registrar merma
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
