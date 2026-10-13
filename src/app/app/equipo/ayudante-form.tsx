'use client';

import { useActionState } from 'react';
import { Aviso, Campo } from '@/components/ui';
import { registrarAyudante, type EstadoAyudante } from './actions';

export function AyudanteForm() {
  const [estado, enviar, enviando] = useActionState<EstadoAyudante, FormData>(registrarAyudante, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};

  return (
    <form key={estado.envio ?? 0} action={enviar} className="tarjeta space-y-4" noValidate>
      <h2 className="text-lg font-bold">Agregar ayudante</h2>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.exito && <Aviso tipo="bien">{estado.exito}</Aviso>}
      <Campo nombre="nombre" etiqueta="Nombre" error={e.nombre}>
        <input id="nombre" name="nombre" className="campo" defaultValue={v.nombre} aria-invalid={!!e.nombre} required />
      </Campo>
      <Campo nombre="email" etiqueta="Correo" error={e.email}>
        <input id="email" name="email" type="email" inputMode="email" className="campo" defaultValue={v.email}
          aria-invalid={!!e.email} required />
      </Campo>
      <Campo nombre="password" etiqueta="Contraseña temporal" error={e.password} ayuda="Mínimo 8 caracteres. Dísela a tu ayudante.">
        <input id="password" name="password" type="text" autoComplete="off" className="campo" aria-invalid={!!e.password} required />
      </Campo>
      <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta de ayudante'}
      </button>
    </form>
  );
}
