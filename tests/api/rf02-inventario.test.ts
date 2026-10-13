// RF02 · HU04, HU05, HU06 — Catálogo, ingreso por lotes y consulta de stock
import { describe, expect, it } from 'vitest';
import { mensajeBD } from '@/lib/errores';
import { categoriaId, crearAyudanteDe, crearDueno, crearProducto, enDias, ingresarLote, loteVencido, stockDe, unico } from './helpers';

describe('HU04 · Catálogo de productos', () => {
  it('CP09 Registro de producto válido', async () => {
    const d = await crearDueno();
    const nombre = `Galletas Soda Field ${unico()}`;
    const { data, error } = await d.client
      .from('productos')
      .insert({ nombre, unidad: 'paquete', precio_venta: 1.2, categoria_id: await categoriaId(d.client, 'Snacks y golosinas') })
      .select('id, nombre, bodega_id, activo')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ nombre, bodega_id: d.bodegaId, activo: true });

    const { data: catalogo } = await d.client.from('v_stock').select('nombre, categoria, stock_disponible');
    expect(catalogo).toContainEqual({ nombre, categoria: 'Snacks y golosinas', stock_disponible: 0 });

    // Edición del precio por el dueño
    const { data: editado } = await d.client.from('productos').update({ precio_venta: 1.5 }).eq('id', data!.id).select('precio_venta').single();
    expect(Number(editado!.precio_venta)).toBe(1.5);
  });

  it('CP10 Registro de producto duplicado o con precio inválido', async () => {
    const d = await crearDueno();
    const cat = await categoriaId(d.client);
    await crearProducto(d.client, { nombre: 'Coca Cola 1 L' });

    // Mismo nombre aunque cambie mayúsculas o espacios
    const dup = await d.client.from('productos').insert({ nombre: '  coca cola 1 l ', unidad: 'botella', precio_venta: 4, categoria_id: cat });
    expect(dup.error?.code).toBe('23505');
    expect(mensajeBD(dup.error, 'producto')).toBe('Ya existe un producto con ese nombre en tu bodega.');

    for (const precio of [0, -1]) {
      const r = await d.client.from('productos').insert({ nombre: `Precio ${precio} ${unico()}`, unidad: 'unidad', precio_venta: precio, categoria_id: cat });
      expect(r.error?.code).toBe('23514');
    }

    // Otra bodega sí puede usar el mismo nombre
    const otra = await crearDueno();
    await expect(crearProducto(otra.client, { nombre: 'Coca Cola 1 L' })).resolves.toBeGreaterThan(0);
  });
});

describe('HU05 · Ingreso de mercadería por lotes', () => {
  it('CP11 Registro de lote válido', async () => {
    const d = await crearDueno();
    const prod = await crearProducto(d.client);
    expect(await stockDe(d.client, prod)).toBe(0);

    await ingresarLote(d.client, prod, 24, 30, 2.1);
    expect(await stockDe(d.client, prod)).toBe(24);
    await ingresarLote(d.client, prod, 12, 60, 2.2);
    expect(await stockDe(d.client, prod)).toBe(36);

    // El saldo del lote siempre nace igual a la cantidad ingresada (aunque se envíe otro valor)
    const { data } = await d.client
      .from('lotes')
      .insert({ producto_id: prod, cantidad_inicial: 5, cantidad_actual: 1, costo_unitario: 2, fecha_vencimiento: enDias(10) })
      .select('cantidad_actual')
      .single();
    expect(Number(data!.cantidad_actual)).toBe(5);

    // Hoy es una fecha válida
    await expect(ingresarLote(d.client, prod, 1, 0)).resolves.toBeGreaterThan(0);
  });

  it('CP12 Registro de lote con fecha vencida', async () => {
    const d = await crearDueno();
    const prod = await crearProducto(d.client);
    const r = await d.client.from('lotes').insert({ producto_id: prod, cantidad_inicial: 6, costo_unitario: 1.5, fecha_vencimiento: enDias(-1) });
    expect(r.error?.message).toBe('La fecha de vencimiento no puede ser anterior a hoy');
    expect(mensajeBD(r.error, 'lote')).toBe('La fecha de vencimiento no puede ser anterior a hoy');
    expect(await stockDe(d.client, prod)).toBe(0);

    // Otras validaciones del lote
    const cero = await d.client.from('lotes').insert({ producto_id: prod, cantidad_inicial: 0, costo_unitario: 1, fecha_vencimiento: enDias(5) });
    expect(cero.error).toBeTruthy();
    const fraccion = await d.client.from('lotes').insert({ producto_id: prod, cantidad_inicial: 2.5, costo_unitario: 1, fecha_vencimiento: enDias(5) });
    expect(fraccion.error?.hint).toBe('CANTIDAD_NO_ENTERA');
    const arroz = await crearProducto(d.client, { nombre: `Arroz a granel ${unico()}`, unidad: 'kg', categoria: 'Abarrotes' });
    await expect(ingresarLote(d.client, arroz, 12.5, 90)).resolves.toBeGreaterThan(0);
  });
});

describe('HU06 · Consulta de stock', () => {
  it('CP13 Consulta de stock con detalle de lotes', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const prod = await crearProducto(d.client);
    const l60 = await ingresarLote(d.client, prod, 10, 60);
    const l5 = await ingresarLote(d.client, prod, 4, 5);
    const l20 = await ingresarLote(d.client, prod, 6, 20);
    const lv = await loteVencido(d.client, prod, 3);

    for (const usuario of [d, a]) {
      const { data: fila } = await usuario.client
        .from('v_stock')
        .select('stock_disponible, stock_vencido, proximo_vencimiento')
        .eq('producto_id', prod)
        .single();
      // Stock total = suma de los lotes vigentes; los vencidos se informan aparte
      expect(fila).toEqual({ stock_disponible: 20, stock_vencido: 3, proximo_vencimiento: enDias(5) });

      // Detalle de lotes ordenado por fecha de vencimiento (misma consulta que la pantalla)
      const { data: lotes } = await usuario.client
        .from('v_lotes')
        .select('id, vencido')
        .eq('producto_id', prod)
        .gt('cantidad_actual', 0)
        .order('fecha_vencimiento')
        .order('id');
      expect(lotes).toEqual([
        { id: lv, vencido: true },
        { id: l5, vencido: false },
        { id: l20, vencido: false },
        { id: l60, vencido: false },
      ]);
    }
  });
});
