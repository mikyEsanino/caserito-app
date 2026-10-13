'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Aviso, Campo } from '@/components/ui';
import { registrarBodega, type EstadoRegistro } from './actions';

export function RegistroForm() {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(registrarBodega, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};

  if (estado.confirmarCorreo) {
    return (
      <div className="tarjeta space-y-4">
        <h1 className="text-xl font-bold">Revisa tu correo</h1>
        <Aviso tipo="bien">
          Te enviamos un enlace a <strong>{estado.confirmarCorreo}</strong>. Ábrelo para activar tu cuenta y entrar a tu bodega.
        </Aviso>
        <Link href="/login" className="btn btn-secundario w-full">Ir a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <form action={accion} className="tarjeta space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-bold">Registra tu bodega</h1>
        <p className="text-sm text-suave">Serás el dueño de la cuenta. Después podrás agregar a tu ayudante.</p>
      </div>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-suave">Tu bodega</legend>
        <Campo nombre="nombre_bodega" etiqueta="Nombre de la bodega" error={e.nombre_bodega}>
          <input id="nombre_bodega" name="nombre_bodega" className="campo" placeholder="Bodega Doña Rosa"
            defaultValue={v.nombre_bodega} aria-invalid={!!e.nombre_bodega} required />
        </Campo>
        <Campo nombre="direccion" etiqueta="Dirección" error={e.direccion}>
          <input id="direccion" name="direccion" className="campo" placeholder="Av. Los Próceres 123, SJL"
            defaultValue={v.direccion} aria-invalid={!!e.direccion} required />
        </Campo>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-suave">Tus datos</legend>
        <Campo nombre="nombre" etiqueta="Tu nombre" error={e.nombre}>
          <input id="nombre" name="nombre" className="campo" autoComplete="name" defaultValue={v.nombre}
            aria-invalid={!!e.nombre} required />
        </Campo>
        <Campo nombre="email" etiqueta="Correo" error={e.email}>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className="campo"
            defaultValue={v.email} aria-invalid={!!e.email} required />
        </Campo>
        <Campo nombre="password" etiqueta="Contraseña" error={e.password} ayuda="Mínimo 8 caracteres.">
          <input id="password" name="password" type="password" autoComplete="new-password" className="campo"
            aria-invalid={!!e.password} required minLength={8} />
        </Campo>
        <Campo nombre="confirmar" etiqueta="Repite la contraseña" error={e.confirmar}>
          <input id="confirmar" name="confirmar" type="password" autoComplete="new-password" className="campo"
            aria-invalid={!!e.confirmar} required />
        </Campo>
      </fieldset>

      <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
        {enviando ? 'Creando tu bodega…' : 'Crear mi bodega'}
      </button>
      <p className="text-center text-sm text-suave">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-marca underline-offset-2 hover:underline">Inicia sesión</Link>
      </p>
    </form>
  );
}
