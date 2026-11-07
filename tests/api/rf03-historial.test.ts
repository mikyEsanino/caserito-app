// RF03 · HU08 — Historial de ventas del día (Sprint 2)
import { describe, expect, it } from 'vitest';
import { hoyLima } from '@/lib/validaciones';
import { moverDia, ventasDelDia } from '@/lib/ventas';
import { admin, crearAyudanteDe, crearDueno, crearProducto, ingresarLote, unico } from './helpers';

describe('HU08 · Historial de ventas del día', () => {
  it('CP18 Listado de ventas del día', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d); // "Luis Ayudante"
    const gaseosa = await crearProducto(d.client, { nombre: `Inca Kola ${unico()}`, precio_venta: 3.5 });
    const arroz = await crearProducto(d.client, { nombre: `Arroz ${unico()}`, unidad: 'kg', precio_venta: 4.2, categoria: 'Abarrotes' });
    await ingresarLote(d.client, gaseosa, 20, 30);
    await ingresarLote(d.client, arroz, 20, 90);

    const v1 = await d.client.rpc('registrar_venta', { p_items: [{ producto_id: gaseosa, cantidad: 2 }, { producto_id: arroz, cantidad: 1.24 }], p_metodo_pago: 'efectivo' });
    const v2 = await a.client.rpc('registrar_venta', { p_items: [{ producto_id: gaseosa, cantidad: 1 }], p_metodo_pago: 'yape' });
    expect(v1.error).toBeNull();
    expect(v2.error).toBeNull();

    const { ventas } = await ventasDelDia(d.client, hoyLima());
    expect(ventas.map((v) => v.id)).toEqual([v2.data.venta_id, v1.data.venta_id]); // la más reciente primero

    const [ultima, primera] = ventas;
    expect(ultima).toMatchObject({ vendedor: 'Luis Ayudante', metodo: 'yape', totalCobrado: 3.5 });
    expect(ultima.hora).toMatch(/^\d{2}:\d{2}$/);
    expect(primera).toMatchObject({ vendedor: 'Rosa Quispe', metodo: 'efectivo', total: 12.21, totalCobrado: 12.2 });
    expect(primera.items).toHaveLength(2);
    expect(primera.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cantidad: 2, subtotal: 7 }),
        expect.objectContaining({ cantidad: 1.24, subtotal: 5.21 }),
      ]),
    );

    // Otra bodega no ve estas ventas
    const otra = await crearDueno();
    expect((await ventasDelDia(otra.client, hoyLima())).ventas).toHaveLength(0);
  });

  it('CP19 Total vendido del día', async () => {
    const d = await crearDueno();
    const prod = await crearProducto(d.client, { precio_venta: 2.35 });
    await ingresarLote(d.client, prod, 50, 30);
    const hoy = hoyLima();
    const ayer = moverDia(hoy, -1);
    const vender = (cantidad: number, metodo: string) => d.client.rpc('registrar_venta', { p_items: [{ producto_id: prod, cantidad }], p_metodo_pago: metodo });

    const e1 = await vender(3, 'efectivo'); // 7,05 → cobra 7,00
    const e2 = await vender(1, 'plin'); //     2,35 exacto
    const viejo = await vender(4, 'efectivo'); // se moverá a ayer 23:30 (Lima)
    const borde = await vender(2, 'yape'); //  se moverá a hoy 00:00 (Lima)
    for (const r of [e1, e2, viejo, borde]) expect(r.error).toBeNull();

    // 23:30 de ayer en Lima ya es "hoy" en UTC: no debe contarse hoy
    await admin.from('ventas').update({ created_at: `${ayer}T23:30:00-05:00` }).eq('id', viejo.data.venta_id);
    await admin.from('ventas').update({ created_at: `${hoy}T00:00:00-05:00` }).eq('id', borde.data.venta_id);

    const { ventas, resumen } = await ventasDelDia(d.client, hoy);
    expect(ventas.map((v) => v.id).sort()).toEqual([e1.data.venta_id, e2.data.venta_id, borde.data.venta_id].sort());
    expect(resumen).toEqual({
      cantidad: 3,
      totalCobrado: 14.05, // 7,00 + 2,35 + 4,70
      redondeo: 0.05,
      porMetodo: { efectivo: 7, plin: 2.35, yape: 4.7 },
    });

    const delDiaAnterior = await ventasDelDia(d.client, ayer);
    expect(delDiaAnterior.resumen).toMatchObject({ cantidad: 1, totalCobrado: 9.4 }); // 4 × 2,35 = 9,40
  });
});
