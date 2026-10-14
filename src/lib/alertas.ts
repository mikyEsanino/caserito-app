import { diasHasta } from './formato';

/** Días de anticipación para avisar que un lote está por vencer. */
export const DIAS_POR_VENCER = 7;

export type FiltroStock = 'todos' | 'vencidos' | 'por-vencer' | 'sin-stock';
export const FILTROS: FiltroStock[] = ['todos', 'vencidos', 'por-vencer', 'sin-stock'];

type ResumenProducto = { stock_disponible: number; stock_vencido: number; proximo_vencimiento: string | null };

export function tieneVencidos(p: ResumenProducto): boolean {
  return p.stock_vencido > 0;
}

export function porVencer(p: ResumenProducto, hoy: string): boolean {
  return p.stock_disponible > 0 && !!p.proximo_vencimiento && diasHasta(p.proximo_vencimiento, hoy) <= DIAS_POR_VENCER;
}

export function sinStock(p: ResumenProducto): boolean {
  return p.stock_disponible <= 0;
}

export function cumpleFiltro(p: ResumenProducto, filtro: FiltroStock, hoy: string): boolean {
  if (filtro === 'vencidos') return tieneVencidos(p);
  if (filtro === 'por-vencer') return porVencer(p, hoy);
  if (filtro === 'sin-stock') return sinStock(p);
  return true;
}

export function aFiltro(v: string | undefined): FiltroStock {
  return FILTROS.includes(v as FiltroStock) ? (v as FiltroStock) : 'todos';
}
