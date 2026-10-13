import { Aviso, Logo } from '@/components/ui';
import { cerrarSesion } from '../acciones-sesion';

export const metadata = { title: 'Cuenta sin bodega' };

export default function SinPerfil() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4">
      <Logo className="text-2xl text-marca" />
      <Aviso tipo="alerta">Tu cuenta no está asociada a ninguna bodega. Pide al dueño que te registre como ayudante o crea una bodega nueva con otro correo.</Aviso>
      <form action={cerrarSesion}>
        <button className="btn btn-secundario w-full">Cerrar sesión</button>
      </form>
    </main>
  );
}
