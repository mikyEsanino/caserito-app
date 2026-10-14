import Link from 'next/link';
import { Aviso } from '@/components/ui';
import { porVencer, sinStock as estaSinStock, tieneVencidos } from '@/lib/alertas';
import { requireContexto } from '@/lib/contexto';
import { createClient } from '@/lib/supabase/server';
import { hoyLima } from '@/lib/validaciones';

export const metadata = { title: 'Inicio' };

export default async function InicioPanel({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string; restringido?: string }>;
}) {
  const ctx = await requireContexto();
  const { bienvenida, restringido } = await searchParams;
  const supabase = await createClient();
  const { data: stock } = await supabase
    .from('v_stock')
    .select('producto_id, stock_disponible, stock_vencido, proximo_vencimiento, activo');

  const hoy = hoyLima();
  const activos = (stock ?? [])
    .filter((p) => p.activo)
    .map((p) => ({ stock_disponible: Number(p.stock_disponible), stock_vencido: Number(p.stock_vencido), proximo_vencimiento: p.proximo_vencimiento }));
  const sinStock = activos.filter(estaSinStock).length;
  const conVencidos = activos.filter(tieneVencidos).length;
  const prontos = activos.filter((p) => porVencer(p, hoy)).length;
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

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato valor={activos.length} texto="productos" href="/app/stock" />
        <Dato valor={conVencidos} texto="con lotes vencidos" tono={conVencidos > 0 ? 'error' : undefined} href="/app/stock?filtro=vencidos" />
        <Dato valor={prontos} texto="por vencer (7 días)" tono={prontos > 0 ? 'alerta' : undefined} href="/app/stock?filtro=por-vencer" />
        <Dato valor={sinStock} texto="sin stock" tono={sinStock > 0 ? 'alerta' : undefined} href="/app/stock?filtro=sin-stock" />
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

// Cada número lleva a la lista ya filtrada: así se ve de inmediato qué producto es
function Dato({ valor, texto, tono, href }: { valor: number; texto: string; tono?: 'alerta' | 'error'; href: string }) {
  const color = tono === 'alerta' ? 'text-alerta' : tono === 'error' ? 'text-error' : 'text-tinta';
  return (
    <Link href={href} className="tarjeta block p-4 text-center hover:border-marca">
      <p className={`text-3xl font-bold ${color}`}>{valor}</p>
      <p className="text-sm text-suave">{texto}</p>
    </Link>
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
