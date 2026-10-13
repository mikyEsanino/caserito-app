// Traduce los errores de Supabase (Auth y PostgREST) a mensajes para el bodeguero.

type ErrorAuth = { code?: string; message?: string; status?: number } | null | undefined;
type ErrorBD = { code?: string; message?: string; hint?: string | null; details?: string | null } | null | undefined;

export const MSJ_CORREO_REGISTRADO = 'El correo ya está registrado';
export const MSJ_CREDENCIALES = 'Correo o contraseña incorrectos';

/** HU01 CA2 / HU03: correo duplicado al registrar una cuenta. */
export function esCorreoDuplicado(err: ErrorAuth): boolean {
  if (!err) return false;
  if (err.code === 'user_already_exists' || err.code === 'email_exists') return true;
  return /already (been )?registered|already exists/i.test(err.message ?? '');
}

export function mensajeRegistro(err: ErrorAuth): string {
  if (esCorreoDuplicado(err)) return MSJ_CORREO_REGISTRADO;
  if (err?.code === 'weak_password') return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
  if (err?.code === 'over_email_send_rate_limit' || err?.status === 429)
    return 'Se hicieron demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  if (err?.code === 'signup_disabled') return 'El registro de cuentas está desactivado.';
  return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
}

/** HU02 CA2: el mensaje no indica si falló el correo o la contraseña. */
export function mensajeLogin(err: ErrorAuth): string {
  if (err?.code === 'email_not_confirmed') return 'Confirma tu correo antes de ingresar (revisa tu bandeja de entrada).';
  if (err?.status === 429 || err?.code === 'over_request_rate_limit')
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  return MSJ_CREDENCIALES;
}

/** Errores de la base de datos al guardar productos, lotes o ventas. */
export function mensajeBD(err: ErrorBD, contexto: 'producto' | 'lote' | 'venta'): string {
  if (!err) return 'Ocurrió un error inesperado.';
  if (err.code === '23505' && contexto === 'producto') return 'Ya existe un producto con ese nombre en tu bodega.';
  if (err.code === '42501') return 'No tienes permiso para realizar esta acción.';
  // Mensajes de negocio lanzados por nuestros triggers y funciones (traen un "hint" conocido)
  const conocidos = ['FECHA_VENCIDA', 'CANTIDAD_NO_ENTERA', 'STOCK_INSUFICIENTE', 'VENTA_VACIA', 'CANTIDAD_INVALIDA', 'PRODUCTO_NO_EXISTE'];
  if (err.hint && conocidos.includes(err.hint) && err.message) return err.message;
  if (err.code === '23514') {
    if (contexto === 'producto') return 'Revisa los datos: el precio debe ser mayor a cero.';
    if (contexto === 'lote') return 'Revisa los datos del lote: la cantidad debe ser mayor a cero.';
  }
  if (err.code === '23503') return 'El producto o la categoría elegidos no existen en tu bodega.';
  return contexto === 'venta' ? 'No se pudo registrar la venta. Inténtalo de nuevo.' : 'No se pudo guardar. Inténtalo de nuevo.';
}
