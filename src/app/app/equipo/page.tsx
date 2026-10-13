import { Encabezado, Insignia } from '@/components/ui';
import { requireDueno } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { AyudanteForm } from './ayudante-form';

export const metadata = { title: 'Equipo' };

export default async function Equipo() {
  const ctx = await requireDueno();
  const supabase = await createClient();
  const { data: miembros } = await supabase.from('perfiles').select('id, nombre, email, rol, created_at').order('created_at');

  return (
    <>
      <Encabezado titulo="Equipo" descripcion="El ayudante puede vender y ver el stock, pero no cambia precios, no ingresa mercadería ni ve costos." />
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="miembros">
          <h2 id="miembros" className="mb-3 text-lg font-bold">Personas en {ctx.bodegaNombre}</h2>
          <ul className="divide-y divide-linea rounded-2xl border border-linea bg-tarjeta" data-testid="lista-equipo">
            {(miembros ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.nombre}{m.id === ctx.userId && ' (tú)'}</p>
                  <p className="truncate text-sm text-suave">{m.email}</p>
                </div>
                <Insignia tono={m.rol === 'dueno' ? 'marca' : 'neutro'}>{m.rol === 'dueno' ? 'Dueño' : 'Ayudante'}</Insignia>
              </li>
            ))}
          </ul>
        </section>
        <AyudanteForm />
      </div>
    </>
  );
}
