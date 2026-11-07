// Filtros de alertas de la pantalla de stock
import { describe, expect, it } from 'vitest';
import { aFiltro, cumpleFiltro, porVencer, stockBajo } from '@/lib/alertas';

const hoy = '2026-10-13';
const prod = (stock_disponible: number, stock_vencido: number, proximo_vencimiento: string | null) => ({ stock_disponible, stock_vencido, proximo_vencimiento });

describe('Alertas de stock', () => {
  it('detecta productos con lotes vencidos', () => {
    expect(cumpleFiltro(prod(10, 2, '2026-12-01'), 'vencidos', hoy)).toBe(true);
    expect(cumpleFiltro(prod(10, 0, '2026-12-01'), 'vencidos', hoy)).toBe(false);
  });

  it('por vencer: hasta 7 días y solo si hay stock', () => {
    expect(porVencer(prod(5, 0, '2026-10-13'), hoy)).toBe(true); // vence hoy
    expect(porVencer(prod(5, 0, '2026-10-20'), hoy)).toBe(true); // 7 días
    expect(porVencer(prod(5, 0, '2026-10-21'), hoy)).toBe(false); // 8 días
    expect(porVencer(prod(0, 0, null), hoy)).toBe(false);
  });

  it('HU14 stock bajo: stock menor o igual al mínimo, solo si hay mínimo definido', () => {
    const conMinimo = (stock: number, minimo: number) => ({ ...prod(stock, 0, null), stock_minimo: minimo });
    expect(stockBajo(conMinimo(5, 5))).toBe(true); // igual al mínimo
    expect(stockBajo(conMinimo(4, 5))).toBe(true);
    expect(stockBajo(conMinimo(0, 5))).toBe(true); // agotado también se repone
    expect(stockBajo(conMinimo(6, 5))).toBe(false);
    expect(stockBajo(conMinimo(0, 0))).toBe(false); // sin mínimo: no alerta
    expect(stockBajo(prod(0, 0, null))).toBe(false);
    expect(cumpleFiltro(conMinimo(2, 10), 'stock-bajo', hoy)).toBe(true);
    expect(aFiltro('stock-bajo')).toBe('stock-bajo');
  });

  it('sin stock y todos', () => {
    expect(cumpleFiltro(prod(0, 3, null), 'sin-stock', hoy)).toBe(true);
    expect(cumpleFiltro(prod(1, 0, null), 'sin-stock', hoy)).toBe(false);
    expect(cumpleFiltro(prod(1, 0, null), 'todos', hoy)).toBe(true);
  });

  it('un filtro desconocido en la URL vuelve a "todos"', () => {
    expect(aFiltro('vencidos')).toBe('vencidos');
    expect(aFiltro('<script>')).toBe('todos');
    expect(aFiltro(undefined)).toBe('todos');
  });
});
