'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDueno } from '@/lib/contexto';
import { mensajeBD } from '@/lib/errores';
import { createClient } from '@/lib/supabase/server';
import { validarProducto } from '@/lib/validaciones';

// envio cambia en cada respuesta: el formulario se vuelve a montar con los valores escritos
// (React 19 no restaura el valor de los <select> al reiniciar el formulario)
export type EstadoProducto = { error?: string; errores?: Record<string, string>; valores?: Record<string, string>; envio?: number };

function valoresDe(fd: FormData) {
  return {
    nombre: String(fd.get('nombre') ?? ''),
    categoria_id: String(fd.get('categoria_id') ?? ''),
    unidad: String(fd.get('unidad') ?? ''),
    precio_venta: String(fd.get('precio_venta') ?? ''),
    stock_minimo: String(fd.get('stock_minimo') ?? ''),
    activo: fd.get('activo') ? 'on' : '',
  };
}

// HU04: registrar producto
export async function crearProducto(prev: EstadoProducto, fd: FormData): Promise<EstadoProducto> {
  await requireDueno();
  const valores = valoresDe(fd);
  const envio = (prev.envio ?? 0) + 1;
  const v = validarProducto(fd);
  if (!v.ok) return { errores: v.errores, valores, envio };

  const supabase = await createClient();
  const { error } = await supabase.from('productos').insert(v.data);
  if (error) return { error: mensajeBD(error, 'producto'), valores, envio };

  revalidatePath('/app', 'layout');
  redirect('/app/productos?ok=creado');
}

// HU04: editar producto
export async function editarProducto(id: number, prev: EstadoProducto, fd: FormData): Promise<EstadoProducto> {
  await requireDueno();
  const valores = valoresDe(fd);
  const envio = (prev.envio ?? 0) + 1;
  const v = validarProducto(fd);
  if (!v.ok) return { errores: v.errores, valores, envio };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('productos')
    .update({ ...v.data, activo: fd.get('activo') === 'on' })
    .eq('id', id)
    .select('id');
  if (error) return { error: mensajeBD(error, 'producto'), valores, envio };
  if (!data?.length) return { error: 'El producto no existe o no tienes permiso para editarlo.', valores, envio };

  revalidatePath('/app', 'layout');
  redirect('/app/productos?ok=editado');
}
