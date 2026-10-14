// RF03 · HU07 — Registro de ventas con descuento automático de stock (FEFO)
import { describe, expect, it } from 'vitest';
import { mensajeBD } from '@/lib/errores';
import { admin, crearDueno, crearProducto, ingresarLote, loteVencido, saldoLote, stockDe, unico } from './helpers';

async function vender(c: Awaited<ReturnType<typeof crearDueno>>['client'], items: { producto_id: number; cantidad: number }[], metodo = 'efectivo') {
  return c.rpc('registrar_venta', { p_items: items, p_metodo_pago: metodo });
}

describe('HU07 · Registro de venta', () => {
  it('CP14 Venta con stock suficiente', async () => {
    const d = await crearDueno();
    const gaseosa = await crearProducto(d.client, { precio_venta: 3.5 });
    const galleta = await crearProducto(d.client, { nombre: `Galleta ${unico()}`, unidad: 'paquete', precio_venta: 1.2, categoria: 'Snacks y golosinas' });
    await ingresarLote(d.client, gaseosa, 10, 30);
    await ingresarLote(d.client, galleta, 20, 30);

    const { data, error } = await vender(d.client, [
      { producto_id: gaseosa, cantidad: 2 },
      { producto_id: galleta, cantidad: 3 },
    ], 'yape');
    expect(error).toBeNull();
    expect(Number(data.total)).toBe(10.6); // 2 × 3,50 + 3 × 1,20

    expect(await stockDe(d.client, gaseosa)).toBe(8);
    expect(await stockDe(d.client, galleta)).toBe(17);

    const { data: venta } = await d.client
      .from('ventas')
      .select('total, metodo_pago, usuario_id, venta_detalle ( producto_id, cantidad, precio_unitario, subtotal )')
      .eq('id', data.venta_id)
      .single();
    expect(venta).toMatchObject({ total: 10.6, metodo_pago: 'yape', usuario_id: d.userId });
    expect(venta!.venta_detalle).toEqual(
      expect.arrayContaining([
        { producto_id: gaseosa, cantidad: 2, precio_unitario: 3.5, subtotal: 7 },
        { producto_id: galleta, cantidad: 3, precio_unitario: 1.2, subtotal: 3.6 },
      ]),
    );

    // El precio lo pone la base de datos, no el cliente
    const trampa = await vender(d.client, [{ producto_id: gaseosa, cantidad: 1, precio: 0.01 } as never]);
    expect(Number(trampa.data.total)).toBe(3.5);
  });

  it('CP15 Descuento de stock por criterio FEFO', async () => {
    const d = await crearDueno();
    const yogurt = await crearProducto(d.client, { nombre: `Yogurt Gloria ${unico()}`, unidad: 'botella', precio_venta: 2.5, categoria: 'Lácteos' });
    // Se ingresan en desorden: el que vence primero se registró al final
    const tarde = await ingresarLote(d.client, yogurt, 5, 40);
    const medio = await ingresarLote(d.client, yogurt, 5, 15);
    const pronto = await ingresarLote(d.client, yogurt, 5, 3);
    const vencido = await loteVencido(d.client, yogurt, 5);

    // 7 unidades: 5 del lote que vence en 3 días y 2 del que vence en 15
    const { data, error } = await vender(d.client, [{ producto_id: yogurt, cantidad: 7 }]);
    expect(error).toBeNull();
    expect(await saldoLote(pronto)).toBe(0);
    expect(await saldoLote(medio)).toBe(3);
    expect(await saldoLote(tarde)).toBe(5);
    expect(await saldoLote(vencido)).toBe(5); // lo vencido nunca se vende

    const { data: trazas } = await admin
      .from('venta_detalle_lotes')
      .select('lote_id, cantidad, venta_detalle!inner ( venta_id )')
      .eq('venta_detalle.venta_id', data.venta_id)
      .order('lote_id');
    expect(trazas?.map((t) => [t.lote_id, Number(t.cantidad)])).toEqual(
      [[medio, 2], [pronto, 5]].sort((a, b) => a[0] - b[0]),
    );
  });

  it('CP16 Venta con stock insuficiente', async () => {
    const d = await crearDueno();
    const leche = await crearProducto(d.client, { nombre: 'Leche Gloria azul', unidad: 'lata', precio_venta: 4.2, categoria: 'Lácteos' });
    await ingresarLote(d.client, leche, 3, 30);
    await loteVencido(d.client, leche, 10); // no cuenta como disponible

    const r = await vender(d.client, [{ producto_id: leche, cantidad: 4 }]);
    expect(r.error?.hint).toBe('STOCK_INSUFICIENTE');
    expect(mensajeBD(r.error, 'venta')).toBe('Stock insuficiente para "Leche Gloria azul": disponible 3');
    expect(await stockDe(d.client, leche)).toBe(3);

    const { count } = await d.client.from('ventas').select('id', { count: 'exact', head: true });
    expect(count).toBe(0);

    // Otras entradas inválidas
    expect((await vender(d.client, [])).error?.hint).toBe('VENTA_VACIA');
    expect((await vender(d.client, [{ producto_id: leche, cantidad: 0 }])).error?.hint).toBe('CANTIDAD_INVALIDA');
    expect((await vender(d.client, [{ producto_id: leche, cantidad: 1.5 }])).error?.hint).toBe('CANTIDAD_NO_ENTERA');
  });

  it('CP17 Atomicidad de la venta ante un error', async () => {
    const d = await crearDueno();
    const pan = await crearProducto(d.client, { nombre: `Pan francés ${unico()}`, unidad: 'unidad', precio_venta: 0.3, categoria: 'Panadería' });
    const azucar = await crearProducto(d.client, { nombre: `Azúcar rubia ${unico()}`, unidad: 'kg', precio_venta: 4.5, categoria: 'Abarrotes' });
    const lotePan = await ingresarLote(d.client, pan, 50, 2);
    await ingresarLote(d.client, azucar, 2, 120);

    // El pan sí tiene stock, el azúcar no: falla todo y no se descuenta nada
    const r = await vender(d.client, [
      { producto_id: pan, cantidad: 10 },
      { producto_id: azucar, cantidad: 2.5 },
    ]);
    expect(r.error?.hint).toBe('STOCK_INSUFICIENTE');
    expect(await saldoLote(lotePan)).toBe(50);
    expect(await stockDe(d.client, azucar)).toBe(2);
    const { count: ventas } = await admin.from('ventas').select('id', { count: 'exact', head: true }).eq('bodega_id', d.bodegaId);
    expect(ventas).toBe(0);
    const { count: detalles } = await admin.from('venta_detalle').select('id', { count: 'exact', head: true }).eq('bodega_id', d.bodegaId);
    expect(detalles).toBe(0);

    // Con cantidades válidas (azúcar fraccionada) la misma venta pasa completa
    const ok = await vender(d.client, [
      { producto_id: pan, cantidad: 10 },
      { producto_id: azucar, cantidad: 1.5 },
    ]);
    expect(ok.error).toBeNull();
    expect(Number(ok.data.total)).toBe(9.75); // 10 × 0,30 + 1,5 × 4,50
    expect(await stockDe(d.client, azucar)).toBe(0.5);
  });

  it('CP14c Redondeo a favor del cliente en efectivo', async () => {
    const d = await crearDueno();
    const arroz = await crearProducto(d.client, { nombre: `Arroz ${unico()}`, unidad: 'kg', precio_venta: 4.2, categoria: 'Abarrotes' });
    await ingresarLote(d.client, arroz, 50, 100);

    // 8,7 kg × 4,20 = 36,54 → en efectivo se cobra 36,50
    const efectivo = await vender(d.client, [{ producto_id: arroz, cantidad: 8.7 }], 'efectivo');
    expect(efectivo.error).toBeNull();
    expect(efectivo.data).toMatchObject({ total: 36.54, total_cobrado: 36.5, redondeo: 0.04 });

    // Con Yape se cobra exacto
    const yape = await vender(d.client, [{ producto_id: arroz, cantidad: 8.7 }], 'yape');
    expect(yape.data).toMatchObject({ total: 36.54, total_cobrado: 36.54, redondeo: 0 });

    const { data: guardada } = await d.client.from('ventas').select('total, total_cobrado').eq('id', efectivo.data.venta_id).single();
    expect(guardada).toEqual({ total: 36.54, total_cobrado: 36.5 });
  });

  it('CP17b Ventas simultáneas del último stock', async () => {
    const d = await crearDueno();
    const prod = await crearProducto(d.client);
    await ingresarLote(d.client, prod, 1, 10);

    // Dos cajas venden la última unidad al mismo tiempo: solo una debe lograrlo
    const resultados = await Promise.all([vender(d.client, [{ producto_id: prod, cantidad: 1 }]), vender(d.client, [{ producto_id: prod, cantidad: 1 }])]);
    expect(resultados.filter((r) => !r.error)).toHaveLength(1);
    expect(resultados.filter((r) => r.error?.hint === 'STOCK_INSUFICIENTE')).toHaveLength(1);
    expect(await stockDe(d.client, prod)).toBe(0);
  });
});
