// Validaciones compartidas entre formularios y pruebas.
// La base de datos repite las reglas críticas (CHECK, triggers y RLS):
// la interfaz valida para dar mensajes claros, la BD garantiza la integridad.

export const UNIDADES = ['unidad', 'paquete', 'botella', 'lata', 'caja', 'bolsa', 'kg', 'litro'] as const;
export type Unidad = (typeof UNIDADES)[number];

export const METODOS_PAGO = ['efectivo', 'yape', 'plin', 'tarjeta', 'otro'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const MIN_PASSWORD = 8;

export type Resultado<T> = { ok: true; data: T } | { ok: false; errores: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function unidadFraccionable(unidad: string): boolean {
  return unidad === 'kg' || unidad === 'litro';
}

function texto(v: FormDataEntryValue | null | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Convierte "3,50" o "3.50" en número. Devuelve NaN si no es un número válido. */
export function aNumero(v: FormDataEntryValue | string | null | undefined): number {
  const s = texto(v as FormDataEntryValue).replace(',', '.');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

function decimales(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/** Fecha de hoy en Lima en formato YYYY-MM-DD (igual que public.hoy() en la BD). */
export function hoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

// ---------------------------------------------------------------- HU01
export type DatosRegistro = {
  nombre_bodega: string;
  direccion: string;
  nombre: string;
  email: string;
  password: string;
};

export function validarRegistro(fd: FormData): Resultado<DatosRegistro> {
  const d = {
    nombre_bodega: texto(fd.get('nombre_bodega')),
    direccion: texto(fd.get('direccion')),
    nombre: texto(fd.get('nombre')),
    email: texto(fd.get('email')).toLowerCase(),
    password: typeof fd.get('password') === 'string' ? (fd.get('password') as string) : '',
  };
  const confirmar = typeof fd.get('confirmar') === 'string' ? (fd.get('confirmar') as string) : '';
  const e: Record<string, string> = {};

  if (d.nombre_bodega.length < 2 || d.nombre_bodega.length > 100) e.nombre_bodega = 'Escribe el nombre de tu bodega (2 a 100 caracteres).';
  if (d.direccion.length < 3 || d.direccion.length > 200) e.direccion = 'Escribe la dirección de la bodega.';
  if (d.nombre.length < 2 || d.nombre.length > 100) e.nombre = 'Escribe tu nombre.';
  if (!EMAIL_RE.test(d.email)) e.email = 'Escribe un correo válido.';
  if (d.password.length < MIN_PASSWORD) e.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  else if (d.password !== confirmar) e.confirmar = 'Las contraseñas no coinciden.';

  return Object.keys(e).length ? { ok: false, errores: e } : { ok: true, data: d };
}

// ---------------------------------------------------------------- HU02
export function validarLogin(fd: FormData): Resultado<{ email: string; password: string }> {
  const email = texto(fd.get('email')).toLowerCase();
  const password = typeof fd.get('password') === 'string' ? (fd.get('password') as string) : '';
  const e: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) e.email = 'Escribe un correo válido.';
  if (!password) e.password = 'Escribe tu contraseña.';
  return Object.keys(e).length ? { ok: false, errores: e } : { ok: true, data: { email, password } };
}

// ---------------------------------------------------------------- HU03
export type DatosAyudante = { nombre: string; email: string; password: string };

export function validarAyudante(fd: FormData): Resultado<DatosAyudante> {
  const d = {
    nombre: texto(fd.get('nombre')),
    email: texto(fd.get('email')).toLowerCase(),
    password: typeof fd.get('password') === 'string' ? (fd.get('password') as string) : '',
  };
  const e: Record<string, string> = {};
  if (d.nombre.length < 2 || d.nombre.length > 100) e.nombre = 'Escribe el nombre del ayudante.';
  if (!EMAIL_RE.test(d.email)) e.email = 'Escribe un correo válido.';
  if (d.password.length < MIN_PASSWORD) e.password = `La contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return Object.keys(e).length ? { ok: false, errores: e } : { ok: true, data: d };
}

// ---------------------------------------------------------------- HU04
export type DatosProducto = {
  nombre: string;
  categoria_id: number;
  unidad: Unidad;
  precio_venta: number;
  stock_minimo: number;
};

export function validarProducto(fd: FormData): Resultado<DatosProducto> {
  const nombre = texto(fd.get('nombre'));
  const categoria_id = Number(texto(fd.get('categoria_id')));
  const unidad = texto(fd.get('unidad')) as Unidad;
  const precio_venta = aNumero(fd.get('precio_venta'));
  const stockMinTxt = texto(fd.get('stock_minimo'));
  const stock_minimo = stockMinTxt === '' ? 0 : aNumero(stockMinTxt);
  const e: Record<string, string> = {};

  if (nombre.length < 2 || nombre.length > 120) e.nombre = 'Escribe el nombre del producto (2 a 120 caracteres).';
  if (!Number.isInteger(categoria_id) || categoria_id <= 0) e.categoria_id = 'Elige una categoría.';
  if (!UNIDADES.includes(unidad)) e.unidad = 'Elige una unidad de venta.';
  if (!Number.isFinite(precio_venta) || precio_venta <= 0) e.precio_venta = 'El precio debe ser mayor a cero.';
  else if (decimales(precio_venta) > 2) e.precio_venta = 'El precio admite como máximo 2 decimales.';
  else if (precio_venta > 99_999_999.99) e.precio_venta = 'El precio es demasiado alto.';
  if (!Number.isFinite(stock_minimo) || stock_minimo < 0) e.stock_minimo = 'El stock mínimo no puede ser negativo.';

  return Object.keys(e).length
    ? { ok: false, errores: e }
    : { ok: true, data: { nombre, categoria_id, unidad, precio_venta, stock_minimo } };
}

// ---------------------------------------------------------------- HU05
export type DatosLote = {
  producto_id: number;
  cantidad_inicial: number;
  costo_unitario: number;
  fecha_vencimiento: string;
};

export function validarLote(fd: FormData, unidadProducto: string | null, hoy: string = hoyLima()): Resultado<DatosLote> {
  const producto_id = Number(texto(fd.get('producto_id')));
  const cantidad_inicial = aNumero(fd.get('cantidad'));
  const costo_unitario = aNumero(fd.get('costo_unitario'));
  const fecha_vencimiento = texto(fd.get('fecha_vencimiento'));
  const e: Record<string, string> = {};

  if (!Number.isInteger(producto_id) || producto_id <= 0 || !unidadProducto) e.producto_id = 'Elige un producto.';
  if (!Number.isFinite(cantidad_inicial) || cantidad_inicial <= 0) e.cantidad = 'La cantidad debe ser mayor a cero.';
  else if (unidadProducto && !unidadFraccionable(unidadProducto) && !Number.isInteger(cantidad_inicial))
    e.cantidad = `La cantidad debe ser un número entero (se vende por ${unidadProducto}).`;
  else if (decimales(cantidad_inicial) > 3) e.cantidad = 'Usa como máximo 3 decimales.';
  if (!Number.isFinite(costo_unitario) || costo_unitario < 0) e.costo_unitario = 'Escribe el costo unitario (0 o más).';
  else if (decimales(costo_unitario) > 2) e.costo_unitario = 'El costo admite como máximo 2 decimales.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_vencimiento) || Number.isNaN(Date.parse(fecha_vencimiento)))
    e.fecha_vencimiento = 'Elige la fecha de vencimiento.';
  else if (fecha_vencimiento < hoy) e.fecha_vencimiento = 'La fecha de vencimiento no puede ser anterior a hoy.';

  return Object.keys(e).length
    ? { ok: false, errores: e }
    : { ok: true, data: { producto_id, cantidad_inicial, costo_unitario, fecha_vencimiento } };
}

// ---------------------------------------------------------------- HU07
export type ItemVenta = { producto_id: number; cantidad: number };

export function validarItemsVenta(items: unknown): Resultado<ItemVenta[]> {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, errores: { items: 'Agrega al menos un producto.' } };
  const limpios: ItemVenta[] = [];
  for (const it of items) {
    const producto_id = Number((it as ItemVenta)?.producto_id);
    const cantidad = Number((it as ItemVenta)?.cantidad);
    if (!Number.isInteger(producto_id) || producto_id <= 0) return { ok: false, errores: { items: 'Hay un producto inválido en la venta.' } };
    if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, errores: { items: 'Todas las cantidades deben ser mayores a cero.' } };
    limpios.push({ producto_id, cantidad });
  }
  return { ok: true, data: limpios };
}
