// RF01 · HU01, HU02, HU03 — Registro, inicio de sesión y roles
import { describe, expect, it } from 'vitest';
import { crearAyudante } from '@/lib/ayudantes';
import { mensajeLogin, mensajeRegistro, MSJ_CORREO_REGISTRADO, MSJ_CREDENCIALES } from '@/lib/errores';
import { admin, anon, crearAyudanteDe, crearDueno, crearProducto, ingresarLote, PASSWORD, unico } from './helpers';

describe('HU01 · Registro de bodega y dueño', () => {
  it('CP01 Registro exitoso de bodega y dueño', async () => {
    const email = `cp01_${unico()}@prueba.pe`;
    const c = anon();
    const { data, error } = await c.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { nombre: 'Rosa Quispe', nombre_bodega: 'Bodega Doña Rosa', direccion: 'Av. Próceres 123' } },
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();

    const { data: perfil } = await admin
      .from('perfiles')
      .select('rol, nombre, email, bodegas ( nombre, direccion )')
      .eq('id', data.user!.id)
      .single();
    expect(perfil).toMatchObject({
      rol: 'dueno',
      nombre: 'Rosa Quispe',
      email,
      bodegas: { nombre: 'Bodega Doña Rosa', direccion: 'Av. Próceres 123' },
    });

    // La bodega nace con sus categorías iniciales
    const { data: cats } = await admin.from('categorias').select('nombre').eq('bodega_id', (await bodegaDe(data.user!.id)));
    expect(cats?.map((x) => x.nombre)).toEqual(expect.arrayContaining(['Abarrotes', 'Bebidas', 'Lácteos']));
  });

  it('CP02 Registro con correo duplicado', async () => {
    const d = await crearDueno();
    const { data, error } = await anon().auth.signUp({
      email: d.email,
      password: PASSWORD,
      options: { data: { nombre: 'Otra', nombre_bodega: 'Otra bodega', direccion: 'Otra dirección' } },
    });
    // Sin confirmación de correo Supabase devuelve error; con confirmación devuelve un usuario sin identidades
    const duplicado = !!error || (data.user?.identities?.length ?? 0) === 0;
    expect(duplicado).toBe(true);
    if (error) expect(mensajeRegistro(error)).toBe(MSJ_CORREO_REGISTRADO);

    // No se creó una segunda bodega para ese correo
    const { count } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('email', d.email);
    expect(count).toBe(1);
  });
});

describe('HU02 · Inicio y cierre de sesión', () => {
  it('CP03 Inicio de sesión válido', async () => {
    const d = await crearDueno('Bodega CP03');
    const c = anon();
    const { data, error } = await c.auth.signInWithPassword({ email: d.email, password: PASSWORD });
    expect(error).toBeNull();
    expect(data.session).toBeTruthy();
    const { data: bodega } = await c.from('bodegas').select('nombre').single();
    expect(bodega?.nombre).toBe('Bodega CP03');
  });

  it('CP04 Inicio de sesión con credenciales inválidas', async () => {
    const d = await crearDueno();
    const malaClave = await anon().auth.signInWithPassword({ email: d.email, password: 'incorrecta123' });
    const correoInexistente = await anon().auth.signInWithPassword({ email: `nadie_${unico()}@prueba.pe`, password: PASSWORD });
    expect(malaClave.error).toBeTruthy();
    expect(correoInexistente.error).toBeTruthy();
    // El mensaje es el mismo en ambos casos: no revela qué dato falló
    expect(mensajeLogin(malaClave.error)).toBe(MSJ_CREDENCIALES);
    expect(mensajeLogin(correoInexistente.error)).toBe(MSJ_CREDENCIALES);
  });

  it('CP05 Acceso a datos sin sesión', async () => {
    const d = await crearDueno();
    await crearProducto(d.client);
    await d.client.auth.signOut();

    // Tras cerrar sesión, el cliente ya no obtiene datos
    const { data: tras } = await d.client.from('productos').select('id');
    expect(tras ?? []).toHaveLength(0);

    // Un visitante anónimo tampoco
    const { data: visitante, error } = await anon().from('productos').select('id');
    expect(error ?? visitante?.length === 0).toBeTruthy();
    const venta = await anon().rpc('registrar_venta', { p_items: [{ producto_id: 1, cantidad: 1 }] });
    expect(venta.error).toBeTruthy();
  });
});

describe('HU03 · Roles dueño y ayudante', () => {
  it('CP06 Registro de ayudante por el dueño', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const { data: perfil } = await a.client.from('perfiles').select('rol, bodega_id').eq('id', a.userId).single();
    expect(perfil).toEqual({ rol: 'ayudante', bodega_id: d.bodegaId });

    // Correo repetido: se rechaza con el mensaje de HU01
    const rep = await crearAyudante(admin, d.bodegaId, { nombre: 'Otro', email: a.email, password: PASSWORD });
    expect(rep).toEqual({ ok: false, error: MSJ_CORREO_REGISTRADO });

    // Registrarse por la pantalla pública no puede unirse a una bodega ajena
    const intruso = await anon().auth.signUp({ email: `intruso_${unico()}@prueba.pe`, password: PASSWORD, options: { data: { bodega_id: d.bodegaId, rol: 'ayudante' } } });
    const { data: pIntruso } = await admin.from('perfiles').select('id').eq('id', intruso.data.user!.id);
    expect(pIntruso).toHaveLength(0);
  });

  it('CP07 Restricciones del rol ayudante', async () => {
    const d = await crearDueno();
    const a = await crearAyudanteDe(d);
    const prod = await crearProducto(d.client, { precio_venta: 3.5 });
    const lote = await ingresarLote(d.client, prod, 10, 30, 2.1);

    // No crea productos
    const nuevo = await a.client.from('productos').insert({ nombre: 'Intento', unidad: 'unidad', precio_venta: 1, categoria_id: 1 });
    expect(nuevo.error).toBeTruthy();

    // No cambia precios (el UPDATE no afecta filas)
    const precio = await a.client.from('productos').update({ precio_venta: 0.5 }).eq('id', prod).select('id');
    expect(precio.data ?? []).toHaveLength(0);
    const { data: p } = await admin.from('productos').select('precio_venta').eq('id', prod).single();
    expect(Number(p!.precio_venta)).toBe(3.5);

    // No ve costos: la tabla lotes no le devuelve nada
    const { data: costos } = await a.client.from('lotes').select('costo_unitario');
    expect(costos ?? []).toHaveLength(0);

    // No ingresa mercadería
    const ingreso = await a.client.from('lotes').insert({ producto_id: prod, cantidad_inicial: 5, costo_unitario: 1, fecha_vencimiento: '2099-01-01' });
    expect(ingreso.error).toBeTruthy();

    // No puede alterar el stock por la vista de lotes
    const trampa = await a.client.from('v_lotes').update({ cantidad_actual: 999 }).eq('id', lote);
    expect(trampa.error).toBeTruthy();

    // Sí ve el stock (sin costos) y sí puede vender
    const { data: vl } = await a.client.from('v_lotes').select('*').eq('id', lote).single();
    expect(vl).not.toHaveProperty('costo_unitario');
    expect(Number(vl!.cantidad_actual)).toBe(10);
    const venta = await a.client.rpc('registrar_venta', { p_items: [{ producto_id: prod, cantidad: 2 }] });
    expect(venta.error).toBeNull();
  });

  it('CP08 Aislamiento de datos entre bodegas', async () => {
    const A = await crearDueno('Bodega A');
    const B = await crearDueno('Bodega B');
    const prodA = await crearProducto(A.client);
    await ingresarLote(A.client, prodA, 5, 30);
    await A.client.rpc('registrar_venta', { p_items: [{ producto_id: prodA, cantidad: 1 }] });

    for (const tabla of ['bodegas', 'perfiles', 'productos', 'lotes', 'ventas', 'venta_detalle', 'v_stock', 'v_lotes']) {
      const { data } = await B.client.from(tabla).select('bodega_id');
      const ajenos = (data ?? []).filter((r: { bodega_id?: string }) => r.bodega_id === A.bodegaId);
      expect(ajenos, `B no debe ver filas de A en ${tabla}`).toHaveLength(0);
    }
    const { data: bodegasVisibles } = await B.client.from('bodegas').select('id');
    expect(bodegasVisibles?.map((b) => b.id)).toEqual([B.bodegaId]);

    // B no puede ingresar mercadería ni vender productos de A
    const lote = await B.client.from('lotes').insert({ producto_id: prodA, cantidad_inicial: 5, costo_unitario: 1, fecha_vencimiento: '2099-01-01' });
    expect(lote.error).toBeTruthy();
    const venta = await B.client.rpc('registrar_venta', { p_items: [{ producto_id: prodA, cantidad: 1 }] });
    expect(venta.error?.message).toBe('Producto no encontrado');

    // B no puede editar productos de A
    const edit = await B.client.from('productos').update({ precio_venta: 0.1 }).eq('id', prodA).select('id');
    expect(edit.data ?? []).toHaveLength(0);
  });
});

async function bodegaDe(userId: string): Promise<string> {
  const { data } = await admin.from('perfiles').select('bodega_id').eq('id', userId).single();
  return data!.bodega_id;
}
