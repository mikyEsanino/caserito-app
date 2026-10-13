'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Aviso, Campo } from '@/components/ui';
import { iniciarSesion, type EstadoLogin } from './actions';

export function LoginForm({ next, aviso }: { next?: string; aviso?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});
  const e = estado.errores ?? {};

  return (
    <form action={accion} className="tarjeta space-y-4" noValidate>
      <h1 className="text-xl font-bold">Iniciar sesión</h1>
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <input type="hidden" name="next" value={next ?? ''} />
      <Campo nombre="email" etiqueta="Correo" error={e.email}>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="campo"
          defaultValue={estado.email} aria-invalid={!!e.email} required />
      </Campo>
      <Campo nombre="password" etiqueta="Contraseña" error={e.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" className="campo"
          aria-invalid={!!e.password} required />
      </Campo>
      <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p className="text-center text-sm text-suave">
        ¿Tienes una bodega y aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-marca underline-offset-2 hover:underline">
          Regístrala aquí
        </Link>
      </p>
    </form>
  );
}
