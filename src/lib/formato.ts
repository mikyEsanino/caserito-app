const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export function enSoles(n: number | string): string {
  return soles.format(Number(n));
}

/** 3 → "3", 2.5 → "2,5" */
export function cantidad(n: number | string): string {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 }).format(Number(n));
}

/** "2026-10-23" → "23/10/2026" sin desfases de zona horaria. */
export function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Días entre hoy (YYYY-MM-DD) y una fecha (YYYY-MM-DD). */
export function diasHasta(iso: string, hoy: string): number {
  const a = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  const b = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export const NOMBRE_UNIDAD: Record<string, string> = {
  unidad: 'unidad',
  paquete: 'paquete',
  botella: 'botella',
  lata: 'lata',
  caja: 'caja',
  bolsa: 'bolsa',
  kg: 'kg',
  litro: 'litro',
};

export const NOMBRE_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};
