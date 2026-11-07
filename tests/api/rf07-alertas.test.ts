// RF07 · HU14 — Alerta de stock mínimo (Sprint 2)
import { describe, expect, it } from 'vitest';
import { cumpleFiltro } from '@/lib/alertas';
import { hoyLima } from '@/lib/validaciones';
import { admin, crearAyudanteDe, crearDueno, crearProducto, ingresarLote } from './helpers';

async function filaStock(c: Awaited<ReturnType<typeof crearDueno>>['client'], productoId: number) {
  const { data, error } = await c
    .from('v_stock')
    .select('stock_disponible, stock_vencido, stock_minimo, proximo_vencimiento')
    .eq('producto_id', productoId)
    .single();
  if (error) throw error;
  return {
    stock_disponible: Number(data.stock_disponible),
    stock_vencido: Number(data.stock_vencido),
    stock_minimo: Number(data.stock_minimo),
    proximo_vencimiento: data.proximo_vencimiento as string | null,
  };
}

describe('HU14 · Alerta de stock mínimo', () => {
  it('CP30 Configuración de stock mínimo', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const prod = await crearProducto(d.client);

    // El dueño define el mínimo
    const { data, error } = await d.client.from('productos').update({ stock_minimo: 12 }).eq('id', prod).select('stock_minimo').single();
    expect(error).toBeNull();
    expect(Number(data!.stock_minimo)).toBe(12);
    expect((await filaStock(d.client, prod)).stock_minimo).toBe(12);

    // El ayudante no puede cambiarlo
    const intento = await a.client.from('productos').update({ stock_minimo: 0 }).eq('id', prod).select('id');
    expect(intento.data ?? []).toHaveLength(0);
    const { data: sigue } = await admin.from('productos').select('stock_minimo').eq('id', prod).single();
    expect(Number(sigue!.stock_minimo)).toBe(12);

    // No se acepta un mínimo negativo
    const negativo = await d.client.from('productos').update({ stock_minimo: -1 }).eq('id', prod);
    expect(negativo.error?.code).toBe('23514');
  });

  it('CP31 Alerta de stock bajo', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const prod = await crearProducto(d.client);
    await d.client.from('productos').update({ stock_minimo: 10 }).eq('id', prod);
    await ingresarLote(d.client, prod, 12, 30);
    const hoy = hoyLima();

    // 12 > 10: todavía no hay alerta
    expect(cumpleFiltro(await filaStock(d.client, prod), 'stock-bajo', hoy)).toBe(false);

    // Al vender 2 queda en 10 (igual al mínimo): aparece la alerta, también para el ayudante
    const venta = await a.client.rpc('registrar_venta', { p_items: [{ producto_id: prod, cantidad: 2 }], p_metodo_pago: 'yape' });
    expect(venta.error).toBeNull();
    expect(cumpleFiltro(await filaStock(d.client, prod), 'stock-bajo', hoy)).toBe(true);
    expect(cumpleFiltro(await filaStock(a.client, prod), 'stock-bajo', hoy)).toBe(true);

    // Al reponer mercadería la alerta desaparece
    await ingresarLote(d.client, prod, 24, 60);
    expect(cumpleFiltro(await filaStock(d.client, prod), 'stock-bajo', hoy)).toBe(false);
  });
});
