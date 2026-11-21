// RF07 · HU13 — Lotes por vencer y registro de mermas (Sprint 3)
import { describe, expect, it } from 'vitest';
import { lotePorVencer } from '@/lib/alertas';
import { hoyLima } from '@/lib/validaciones';
import { admin, crearAyudanteDe, crearDueno, crearProducto, ingresarLote, loteVencido, saldoLote, stockDe } from './helpers';

describe('HU13 · Vencimientos y mermas', () => {
  it('CP28 Alerta de lotes por vencer con días configurables', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const prod = await crearProducto(d.client);
    const pronto = await ingresarLote(d.client, prod, 6, 5);
    const lejos = await ingresarLote(d.client, prod, 6, 12);

    // Por defecto se avisa con 7 días de anticipación
    const { data: b } = await d.client.from('bodegas').select('dias_aviso_vencimiento').eq('id', d.bodegaId).single();
    expect(b!.dias_aviso_vencimiento).toBe(7);

    const lotes = async () => {
      const { data, error } = await d.client.from('lotes').select('id, cantidad_actual, fecha_vencimiento').eq('producto_id', prod).order('id');
      if (error) throw error;
      return data.map((l) => ({ id: l.id, cantidad_actual: Number(l.cantidad_actual), fecha_vencimiento: l.fecha_vencimiento }));
    };
    const avisados = async (dias: number) => (await lotes()).filter((l) => lotePorVencer(l, hoyLima(), dias)).map((l) => l.id);

    expect(await avisados(7)).toEqual([pronto]);

    // El dueño amplía el aviso a 15 días: ahora aparecen los dos lotes
    const { error } = await d.client.from('bodegas').update({ dias_aviso_vencimiento: 15 }).eq('id', d.bodegaId);
    expect(error).toBeNull();
    const { data: b2 } = await d.client.from('bodegas').select('dias_aviso_vencimiento').eq('id', d.bodegaId).single();
    expect(await avisados(b2!.dias_aviso_vencimiento)).toEqual([pronto, lejos].sort((x, y) => x - y));

    // Fuera de rango se rechaza, y el ayudante no puede cambiarlo
    const fuera = await d.client.from('bodegas').update({ dias_aviso_vencimiento: 0 }).eq('id', d.bodegaId);
    expect(fuera.error?.code).toBe('23514');
    const intento = await a.client.from('bodegas').update({ dias_aviso_vencimiento: 30 }).eq('id', d.bodegaId).select('id');
    expect(intento.data ?? []).toHaveLength(0);
    const { data: sigue } = await admin.from('bodegas').select('dias_aviso_vencimiento').eq('id', d.bodegaId).single();
    expect(sigue!.dias_aviso_vencimiento).toBe(15);
  });

  it('CP29 Registro de lote vencido como merma', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const otro = await crearDueno();
    const prod = await crearProducto(d.client);
    const vencido = await loteVencido(d.client, prod, 8); // costo 2.10 c/u
    const vigente = await ingresarLote(d.client, prod, 5, 10);

    // Antes de la merma: los vencidos no se venden pero siguen en el lote
    const antes = await d.client.from('v_stock').select('stock_vencido').eq('producto_id', prod).single();
    expect(Number(antes.data!.stock_vencido)).toBe(8);

    // El ayudante no puede registrar mermas ni ver la tabla
    const delAyudante = await a.client.rpc('registrar_merma', { p_lote_id: vencido });
    expect(delAyudante.error?.code).toBe('42501');
    // Otra bodega no encuentra el lote
    const ajeno = await otro.client.rpc('registrar_merma', { p_lote_id: vencido });
    expect(ajeno.error?.hint).toBe('LOTE_NO_EXISTE');
    // Un lote que aún no vence no se puede dar de baja
    const noVencido = await d.client.rpc('registrar_merma', { p_lote_id: vigente });
    expect(noVencido.error?.hint).toBe('LOTE_NO_VENCIDO');

    // El dueño registra la merma
    const { data, error } = await d.client.rpc('registrar_merma', { p_lote_id: vencido });
    expect(error).toBeNull();
    expect(Number(data.cantidad)).toBe(8);
    expect(Number(data.costo_total)).toBe(16.8);

    // El lote queda en cero, el stock vencido desaparece y el disponible no cambia
    expect(await saldoLote(vencido)).toBe(0);
    const despues = await d.client.from('v_stock').select('stock_vencido').eq('producto_id', prod).single();
    expect(Number(despues.data!.stock_vencido)).toBe(0);
    expect(await stockDe(d.client, prod)).toBe(5);

    // La merma queda registrada para el dueño, no para el ayudante
    const { data: mermas } = await d.client.from('mermas').select('lote_id, cantidad, costo_total, motivo');
    expect(mermas).toEqual([{ lote_id: vencido, cantidad: 8, costo_total: 16.8, motivo: 'vencido' }]);
    const vistaAyudante = await a.client.from('mermas').select('id');
    expect(vistaAyudante.data ?? []).toHaveLength(0);

    // No se puede registrar dos veces
    const repetida = await d.client.rpc('registrar_merma', { p_lote_id: vencido });
    expect(repetida.error?.hint).toBe('LOTE_SIN_SALDO');
  });
});
