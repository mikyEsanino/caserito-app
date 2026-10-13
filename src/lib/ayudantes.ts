import type { SupabaseClient } from '@supabase/supabase-js';
import { esCorreoDuplicado, MSJ_CORREO_REGISTRADO } from './errores';
import type { DatosAyudante } from './validaciones';

/**
 * HU03: crea la cuenta del ayudante y su perfil en la bodega del dueño.
 * Recibe el cliente con clave de servicio (solo servidor). Si falla el perfil,
 * se elimina la cuenta para no dejar usuarios a medias.
 */
export async function crearAyudante(
  admin: SupabaseClient,
  bodegaId: string,
  datos: DatosAyudante,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });

  if (error || !data.user) {
    if (esCorreoDuplicado(error)) return { ok: false, error: MSJ_CORREO_REGISTRADO };
    if (error?.code === 'weak_password') return { ok: false, error: 'La contraseña temporal es muy débil.' };
    return { ok: false, error: 'No se pudo crear la cuenta del ayudante.' };
  }

  const { error: errPerfil } = await admin.from('perfiles').insert({
    id: data.user.id,
    bodega_id: bodegaId,
    nombre: datos.nombre,
    email: datos.email,
    rol: 'ayudante',
  });

  if (errPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: 'No se pudo registrar al ayudante en la bodega.' };
  }

  return { ok: true, userId: data.user.id };
}
