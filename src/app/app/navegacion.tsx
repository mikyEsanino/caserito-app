'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Rol } from '@/lib/contexto';

type Item = { href: string; texto: string; icono: string; soloDueno?: boolean };

const ITEMS: Item[] = [
  { href: '/app', texto: 'Inicio', icono: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/app/vender', texto: 'Vender', icono: 'M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z' },
  { href: '/app/stock', texto: 'Stock', icono: 'M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4' },
  { href: '/app/mercaderia', texto: 'Mercadería', icono: 'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16', soloDueno: true },
  { href: '/app/productos', texto: 'Productos', icono: 'M4 6h16M4 12h16M4 18h10', soloDueno: true },
  { href: '/app/equipo', texto: 'Equipo', icono: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8', soloDueno: true },
];

export function Navegacion({ rol, variante }: { rol: Rol; variante: 'lateral' | 'inferior' }) {
  const ruta = usePathname();
  const items = ITEMS.filter((i) => !i.soloDueno || rol === 'dueno');
  const activo = (href: string) => (href === '/app' ? ruta === '/app' : ruta.startsWith(href));

  if (variante === 'inferior') {
    return (
      <nav aria-label="Menú principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-tarjeta/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {items.map((i) => (
            <li key={i.href} className="flex-1">
              <Link href={i.href} aria-current={activo(i.href) ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold ${activo(i.href) ? 'text-marca' : 'text-suave'}`}>
                <Icono d={i.icono} />
                {i.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Menú principal" className="hidden md:block">
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={activo(i.href) ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${activo(i.href) ? 'bg-marca-clara text-marca-oscura' : 'text-tinta hover:bg-papel'}`}>
              <Icono d={i.icono} />
              {i.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Icono({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
