import { diasHasta } from './formato';

/** Días de anticipación por defecto para avisar que un lote está por vencer (HU13: el dueño puede cambiarlos). */
export const DIAS_POR_VENCER = 7;

export type FiltroStock = 'todos' | 'vencidos' | 'por-vencer' | 'stock-bajo' | 'sin-stock';
export const FILTROS: FiltroStock[] = ['todos', 'vencidos', 'por-vencer', 'stock-bajo', 'sin-stock'];

type ResumenProducto = {
  stock_disponible: number;
  stock_vencido: number;
  proximo_vencimiento: string | null;
  stock_minimo?: number;
};

export function tieneVencidos(p: ResumenProducto): boolean {
  return p.stock_vencido > 0;
}

export function porVencer(p: ResumenProducto, hoy: string, dias: number = DIAS_POR_VENCER): boolean {
  return p.stock_disponible > 0 && !!p.proximo_vencimiento && diasHasta(p.proximo_vencimiento, hoy) <= dias;
}

/** HU13 CA1: un lote con saldo que vence entre hoy y los próximos `dias` días. */
export function lotePorVencer(l: { cantidad_actual: number; fecha_vencimiento: string }, hoy: string, dias: number = DIAS_POR_VENCER): boolean {
  const d = diasHasta(l.fecha_vencimiento, hoy);
  return l.cantidad_actual > 0 && d >= 0 && d <= dias;
}

export function sinStock(p: ResumenProducto): boolean {
  return p.stock_disponible <= 0;
}

/** HU14: el stock llegó al mínimo que definió el dueño (solo si definió uno). */
export function stockBajo(p: ResumenProducto): boolean {
  const minimo = p.stock_minimo ?? 0;
  return minimo > 0 && p.stock_disponible <= minimo;
}

export function cumpleFiltro(p: ResumenProducto, filtro: FiltroStock, hoy: string, dias: number = DIAS_POR_VENCER): boolean {
  if (filtro === 'vencidos') return tieneVencidos(p);
  if (filtro === 'por-vencer') return porVencer(p, hoy, dias);
  if (filtro === 'stock-bajo') return stockBajo(p);
  if (filtro === 'sin-stock') return sinStock(p);
  return true;
}

export function aFiltro(v: string | undefined): FiltroStock {
  return FILTROS.includes(v as FiltroStock) ? (v as FiltroStock) : 'todos';
}
