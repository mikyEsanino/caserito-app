import Link from 'next/link';
import { Aviso } from '@/components/ui';
import { requireContexto } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Inicio' };

export default async function InicioPanel({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string; restringido?: string }>;
}) {
  const ctx = await requireContexto();
  const { bienvenida, restringido } = await searchParams;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('v_stock').select('producto_id, stock_disponible, stock_vencido, activo');

  const activos = (stock ?? []).filter((p) => p.activo);
  const sinStock = activos.filter((p) => Number(p.stock_disponible) <= 0).length;
  const conVencidos = activos.filter((p) => Number(p.stock_vencido) > 0).length;
  const esDueno = ctx.rol === 'dueno';

  return (
    <div className="space-y-6">
      {bienvenida && <Aviso tipo="bien">¡Bienvenido a Caserito! Tu bodega ya está creada. Empieza registrando tus productos.</Aviso>}
      {restringido && <Aviso tipo="alerta">Esa opción solo está disponible para el dueño de la bodega.</Aviso>}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {ctx.nombre.split(' ')[0]}</h1>
        <p className="text-suave">¿Qué hacemos hoy en {ctx.bodegaNombre}?</p>
      </div>

      <Link href="/app/vender" className="flex items-center justify-between rounded-2xl bg-marca p-6 text-white shadow-sm hover:bg-marca-oscura">
        <span>
          <span className="block text-2xl font-bold">Registrar venta</span>
          <span className="text-white/85">Elige productos y el stock se descuenta solo</span>
        </span>
        <span aria-hidden="true" className="text-4xl">→</span>
      </Link>

      <section aria-label="Resumen" className="grid grid-cols-3 gap-3">
        <Dato valor={activos.length} texto="productos" />
        <Dato valor={sinStock} texto="sin stock" tono={sinStock > 0 ? 'alerta' : undefined} />
        <Dato valor={conVencidos} texto="con lotes vencidos" tono={conVencidos > 0 ? 'error' : undefined} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Atajo href="/app/stock" titulo="Ver stock" texto="Cuánto tienes de cada producto y sus lotes" />
        {esDueno && <Atajo href="/app/mercaderia" titulo="Ingresar mercadería" texto="Registra un lote con su fecha de vencimiento" />}
        {esDueno && <Atajo href="/app/productos" titulo="Productos" texto="Tu catálogo y precios de venta" />}
        {esDueno && <Atajo href="/app/equipo" titulo="Equipo" texto="Crea la cuenta de tu ayudante" />}
      </section>
    </div>
  );
}

function Dato({ valor, texto, tono }: { valor: number; texto: string; tono?: 'alerta' | 'error' }) {
  const color = tono === 'alerta' ? 'text-alerta' : tono === 'error' ? 'text-error' : 'text-tinta';
  return (
    <div className="tarjeta p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{valor}</p>
      <p className="text-sm text-suave">{texto}</p>
    </div>
  );
}

function Atajo({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return (
    <Link href={href} className="tarjeta block hover:border-marca">
      <span className="block text-lg font-bold">{titulo}</span>
      <span className="text-suave">{texto}</span>
    </Link>
  );
}
