// Pruebas unitarias de las reglas de validación de los formularios
import { describe, expect, it } from 'vitest';
import { esCorreoDuplicado, mensajeBD, mensajeLogin, MSJ_CREDENCIALES } from '@/lib/errores';
import { diasHasta, enSoles, fecha } from '@/lib/formato';
import {
  aNumero,
  hoyLima,
  validarAyudante,
  validarItemsVenta,
  validarLote,
  validarProducto,
  validarRegistro,
} from '@/lib/validaciones';

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe('Registro (HU01)', () => {
  const base = { nombre_bodega: 'Bodega Rosa', direccion: 'Av. Lima 123', nombre: 'Rosa', email: 'Rosa@Correo.pe', password: '12345678', confirmar: '12345678' };

  it('acepta datos válidos y normaliza el correo', () => {
    const r = validarRegistro(fd(base));
    expect(r.ok && r.data.email).toBe('rosa@correo.pe');
  });

  it('exige contraseña de al menos 8 caracteres y que coincidan', () => {
    const corta = validarRegistro(fd({ ...base, password: '1234567', confirmar: '1234567' }));
    expect(!corta.ok && corta.errores.password).toMatch(/8 caracteres/);
    const distinta = validarRegistro(fd({ ...base, confirmar: '87654321' }));
    expect(!distinta.ok && distinta.errores.confirmar).toBe('Las contraseñas no coinciden.');
  });

  it('rechaza correo inválido y campos vacíos', () => {
    const r = validarRegistro(fd({ ...base, email: 'rosa@', nombre_bodega: ' ', direccion: '' }));
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(['direccion', 'email', 'nombre_bodega']);
  });
});

describe('Ayudante (HU03)', () => {
  it('exige contraseña temporal de 8 caracteres', () => {
    const r = validarAyudante(fd({ nombre: 'Luis', email: 'luis@correo.pe', password: 'abc' }));
    expect(!r.ok && r.errores.password).toBeTruthy();
  });
});

describe('Producto (HU04)', () => {
  const base = { nombre: 'Inca Kola 500 ml', categoria_id: '2', unidad: 'botella', precio_venta: '3,50', stock_minimo: '' };

  it('acepta coma decimal', () => {
    const r = validarProducto(fd(base));
    expect(r.ok && r.data).toEqual({ nombre: 'Inca Kola 500 ml', categoria_id: 2, unidad: 'botella', precio_venta: 3.5, stock_minimo: 0 });
  });

  it.each(['0', '-2', 'abc', '1.999'])('rechaza precio "%s"', (precio) => {
    const r = validarProducto(fd({ ...base, precio_venta: precio }));
    expect(!r.ok && r.errores.precio_venta).toBeTruthy();
  });

  it('rechaza unidad desconocida', () => {
    const r = validarProducto(fd({ ...base, unidad: 'docena' }));
    expect(!r.ok && r.errores.unidad).toBeTruthy();
  });
});

describe('Lote (HU05)', () => {
  const hoy = '2026-10-12';
  const base = { producto_id: '5', cantidad: '24', costo_unitario: '2.10', fecha_vencimiento: '2026-11-30' };

  it('acepta un lote válido y la fecha de hoy', () => {
    expect(validarLote(fd(base), 'botella', hoy).ok).toBe(true);
    expect(validarLote(fd({ ...base, fecha_vencimiento: hoy }), 'botella', hoy).ok).toBe(true);
  });

  it('rechaza fecha anterior a hoy', () => {
    const r = validarLote(fd({ ...base, fecha_vencimiento: '2026-10-11' }), 'botella', hoy);
    expect(!r.ok && r.errores.fecha_vencimiento).toBe('La fecha de vencimiento no puede ser anterior a hoy.');
  });

  it('exige enteros salvo en kg o litro', () => {
    expect(validarLote(fd({ ...base, cantidad: '2.5' }), 'botella', hoy).ok).toBe(false);
    expect(validarLote(fd({ ...base, cantidad: '2,5' }), 'kg', hoy).ok).toBe(true);
  });

  it('rechaza cantidad cero y producto inexistente', () => {
    const r = validarLote(fd({ ...base, cantidad: '0' }), null, hoy);
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(['cantidad', 'producto_id']);
  });
});

describe('Venta (HU07)', () => {
  it('valida los ítems antes de llamar a la base de datos', () => {
    expect(validarItemsVenta([]).ok).toBe(false);
    expect(validarItemsVenta([{ producto_id: 1, cantidad: 0 }]).ok).toBe(false);
    expect(validarItemsVenta([{ producto_id: 'x', cantidad: 1 }]).ok).toBe(false);
    expect(validarItemsVenta([{ producto_id: 1, cantidad: 2 }])).toEqual({ ok: true, data: [{ producto_id: 1, cantidad: 2 }] });
  });
});

describe('Mensajes de error', () => {
  it('el inicio de sesión no revela qué dato falló (HU02 CA2)', () => {
    expect(mensajeLogin({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 })).toBe(MSJ_CREDENCIALES);
  });

  it('detecta correo duplicado en sus distintas formas', () => {
    expect(esCorreoDuplicado({ code: 'user_already_exists' })).toBe(true);
    expect(esCorreoDuplicado({ code: 'email_exists' })).toBe(true);
    expect(esCorreoDuplicado({ message: 'A user with this email address has already been registered' })).toBe(true);
    expect(esCorreoDuplicado({ code: 'weak_password' })).toBe(false);
  });

  it('muestra el mensaje de negocio de la BD', () => {
    expect(mensajeBD({ code: 'P0001', message: 'Stock insuficiente para "Pan": disponible 2', hint: 'STOCK_INSUFICIENTE' }, 'venta')).toBe(
      'Stock insuficiente para "Pan": disponible 2',
    );
    expect(mensajeBD({ code: '23505', message: 'duplicate key' }, 'producto')).toMatch(/Ya existe/);
  });
});

describe('Formato y fechas', () => {
  it('usa la fecha de Lima, no la de UTC', () => {
    // 12/10/2026 a las 8 p. m. en Lima = 13/10/2026 01:00 UTC
    expect(hoyLima(new Date('2026-10-13T01:00:00Z'))).toBe('2026-10-12');
  });

  it('formatea soles, fechas y días', () => {
    expect(enSoles(3.5).replace(/\s/g, ' ')).toMatch(/S\/\s?3\.50/);
    expect(fecha('2026-10-23')).toBe('23/10/2026');
    expect(diasHasta('2026-10-15', '2026-10-12')).toBe(3);
    expect(aNumero('3,5')).toBe(3.5);
    expect(Number.isNaN(aNumero('3,5,1'))).toBe(true);
  });
});
