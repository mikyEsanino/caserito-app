import { Logo } from '@/components/ui';
import { requireContexto } from '@/lib/contexto';
import { cerrarSesion } from '../acciones-sesion';
import { Navegacion } from './navegacion';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContexto();

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-linea bg-tarjeta/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Logo className="text-lg text-marca" />
            <p className="truncate text-sm text-suave" data-testid="bodega-nombre">{ctx.bodegaNombre}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold" data-testid="usuario-nombre">{ctx.nombre}</p>
              <p className="text-xs text-suave" data-testid="usuario-rol">{ctx.rol === 'dueno' ? 'Dueño' : 'Ayudante'}</p>
            </div>
            <form action={cerrarSesion}>
              <button type="submit" className="rounded-lg border border-linea px-3 py-2 text-sm font-semibold hover:bg-papel">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <Navegacion rol={ctx.rol} variante="lateral" />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Navegacion rol={ctx.rol} variante="inferior" />
    </div>
  );
}
