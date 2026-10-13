import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { crearAyudante } from '@/lib/ayudantes';
import { hoyLima } from '@/lib/validaciones';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON || !SERVICE) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY para las pruebas');
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(URL, SERVICE, opciones);
export const anon = () => createClient(URL, ANON, opciones);

export const PASSWORD = 'Clave_segura_123';
export const unico = () => randomUUID().slice(0, 8);

/** Fecha YYYY-MM-DD a N días de hoy (hora de Lima). */
export function enDias(n: number): string {
  const [y, m, d] = hoyLima().split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

export type Usuario = { client: SupabaseClient; userId: string; email: string; bodegaId: string };

async function iniciar(email: string, password = PASSWORD): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

/** Registra un dueño como lo hace la pantalla de registro (signUp público). */
export async function crearDueno(nombreBodega = `Bodega ${unico()}`): Promise<Usuario> {
  const email = `dueno_${unico()}@prueba.pe`;
  const c = anon();
  const { data, error } = await c.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { nombre: 'Rosa Quispe', nombre_bodega: nombreBodega, direccion: 'Jr. Los Olivos 123' } },
  });
  if (error) throw error;
  const client = data.session ? c : await iniciar(email);
  const { data: perfil, error: e2 } = await client.from('perfiles').select('bodega_id').eq('id', data.user!.id).single();
  if (e2) throw e2;
  return { client, userId: data.user!.id, email, bodegaId: perfil.bodega_id };
}

export async function crearAyudanteDe(dueno: Usuario): Promise<Usuario> {
  const email = `ayudante_${unico()}@prueba.pe`;
  const r = await crearAyudante(admin, dueno.bodegaId, { nombre: 'Luis Ayudante', email, password: PASSWORD });
  if (!r.ok) throw new Error(r.error);
  return { client: await iniciar(email), userId: r.userId, email, bodegaId: dueno.bodegaId };
}

export async function categoriaId(c: SupabaseClient, nombre = 'Bebidas'): Promise<number> {
  const { data, error } = await c.from('categorias').select('id').eq('nombre', nombre).single();
  if (error) throw error;
  return data.id;
}

export async function crearProducto(
  c: SupabaseClient,
  p: Partial<{ nombre: string; unidad: string; precio_venta: number; categoria: string }> = {},
): Promise<number> {
  const { data, error } = await c
    .from('productos')
    .insert({
      nombre: p.nombre ?? `Inca Kola 500 ml ${unico()}`,
      unidad: p.unidad ?? 'botella',
      precio_venta: p.precio_venta ?? 3.5,
      categoria_id: await categoriaId(c, p.categoria ?? 'Bebidas'),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function ingresarLote(c: SupabaseClient, productoId: number, cantidad: number, venceEnDias: number, costo = 2.1): Promise<number> {
  const { data, error } = await c
    .from('lotes')
    .insert({ producto_id: productoId, cantidad_inicial: cantidad, costo_unitario: costo, fecha_vencimiento: enDias(venceEnDias) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Lote ya vencido: se registra válido y luego se retrocede la fecha con la clave de servicio. */
export async function loteVencido(c: SupabaseClient, productoId: number, cantidad: number): Promise<number> {
  const id = await ingresarLote(c, productoId, cantidad, 1);
  const { error } = await admin.from('lotes').update({ fecha_vencimiento: enDias(-2) }).eq('id', id);
  if (error) throw error;
  return id;
}

export async function stockDe(c: SupabaseClient, productoId: number): Promise<number> {
  const { data, error } = await c.from('v_stock').select('stock_disponible').eq('producto_id', productoId).single();
  if (error) throw error;
  return Number(data.stock_disponible);
}

export async function saldoLote(loteId: number): Promise<number> {
  const { data, error } = await admin.from('lotes').select('cantidad_actual').eq('id', loteId).single();
  if (error) throw error;
  return Number(data.cantidad_actual);
}
