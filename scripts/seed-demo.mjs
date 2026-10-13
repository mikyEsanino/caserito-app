// T20 · Datos de prueba para la demo: una bodega con dueño, ayudante, productos, lotes y ventas.
// Uso: npm run seed   (lee .env.local; necesita SUPABASE_SERVICE_ROLE_KEY)
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('Faltan variables en .env.local (URL, ANON y SERVICE_ROLE). Revisa .env.example.');
  process.exit(1);
}

const DUENO = { email: process.env.DEMO_EMAIL ?? 'demo@caserito.pe', password: process.env.DEMO_PASSWORD ?? 'Caserito2026', nombre: 'Rosa Quispe' };
const AYUDANTE = { email: 'ayudante@caserito.pe', password: 'Ayudante2026', nombre: 'Luis Huamán' };
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);

function enDias(n) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  const [y, m, d] = hoy.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function falla(paso, error) {
  console.error(`✗ ${paso}: ${error?.message ?? error}`);
  process.exit(1);
}

// 1. Dueño y bodega (el trigger registrar_dueno crea la bodega y su perfil)
const { data: creado, error: e1 } = await admin.auth.admin.createUser({
  email: DUENO.email,
  password: DUENO.password,
  email_confirm: true,
  user_metadata: { nombre: DUENO.nombre, nombre_bodega: 'Bodega Doña Rosa', direccion: 'Av. Los Próceres 123, San Juan de Lurigancho' },
});
if (e1) {
  if (/already/i.test(e1.message)) {
    console.log(`La cuenta ${DUENO.email} ya existe: no se vuelven a cargar los datos de demo.`);
    process.exit(0);
  }
  falla('Crear dueño', e1);
}

const dueno = createClient(URL, ANON, opts);
const { error: e2 } = await dueno.auth.signInWithPassword({ email: DUENO.email, password: DUENO.password });
if (e2) falla('Iniciar sesión como dueño', e2);
const { data: perfil, error: e3 } = await dueno.from('perfiles').select('bodega_id').eq('id', creado.user.id).single();
if (e3) falla('Leer perfil del dueño (¿se aplicó la migración?)', e3);

// 2. Ayudante
const { data: ay, error: e4 } = await admin.auth.admin.createUser({
  email: AYUDANTE.email, password: AYUDANTE.password, email_confirm: true, user_metadata: { nombre: AYUDANTE.nombre },
});
if (e4) falla('Crear ayudante', e4);
const { error: e5 } = await admin.from('perfiles').insert({ id: ay.user.id, bodega_id: perfil.bodega_id, nombre: AYUDANTE.nombre, email: AYUDANTE.email, rol: 'ayudante' });
if (e5) falla('Perfil del ayudante', e5);

// 3. Productos
const { data: cats } = await dueno.from('categorias').select('id, nombre');
const cat = Object.fromEntries(cats.map((c) => [c.nombre, c.id]));
const productos = [
  ['Inca Kola 500 ml', 'Bebidas', 'botella', 3.5, [[24, 2.1, 45], [6, 2.0, 4]]],
  ['Coca-Cola 1.5 L', 'Bebidas', 'botella', 7.5, [[12, 5.6, 90]]],
  ['Agua San Luis 625 ml', 'Bebidas', 'botella', 1.5, [[24, 0.9, 300]]],
  ['Leche Gloria azul 400 g', 'Lácteos', 'lata', 4.2, [[24, 3.4, 240]]],
  ['Yogurt Gloria fresa 1 L', 'Lácteos', 'botella', 6.9, [[6, 5.4, 3], [6, 5.4, 18]]],
  ['Huevos', 'Abarrotes', 'unidad', 0.6, [[90, 0.45, 12]]],
  ['Arroz Costeño a granel', 'Abarrotes', 'kg', 4.2, [[50, 3.3, 200]]],
  ['Azúcar rubia', 'Abarrotes', 'kg', 4.5, [[25, 3.6, 300]]],
  ['Aceite Primor 900 ml', 'Abarrotes', 'botella', 10.9, [[12, 8.9, 270]]],
  ['Atún Florida 140 g', 'Abarrotes', 'lata', 6.5, [[24, 5.1, 500]]],
  ['Galletas Soda Field', 'Snacks y golosinas', 'paquete', 1.2, [[30, 0.8, 90]]],
  ['Papas Lay’s clásicas', 'Snacks y golosinas', 'bolsa', 2.5, [[20, 1.7, 6]]],
  ['Pan francés', 'Panadería', 'unidad', 0.3, [[60, 0.2, 1]]],
  ['Detergente Bolívar 900 g', 'Limpieza', 'bolsa', 9.9, [[10, 7.8, 700]]],
  ['Jabón Camay', 'Cuidado personal', 'unidad', 2.8, [[15, 2.0, 900]]],
];

const ids = {};
for (const [nombre, categoria, unidad, precio, lotes] of productos) {
  const { data: p, error } = await dueno.from('productos').insert({ nombre, unidad, precio_venta: precio, categoria_id: cat[categoria] }).select('id').single();
  if (error) falla(`Producto ${nombre}`, error);
  ids[nombre] = p.id;
  for (const [cantidad, costo, dias] of lotes) {
    const { error: el } = await dueno.from('lotes').insert({ producto_id: p.id, cantidad_inicial: cantidad, costo_unitario: costo, fecha_vencimiento: enDias(dias) });
    if (el) falla(`Lote de ${nombre}`, el);
  }
}

// Un lote ya vencido para mostrar que no se vende (se registra válido y luego se retrocede su fecha)
const { data: lv } = await dueno.from('lotes').insert({ producto_id: ids['Yogurt Gloria fresa 1 L'], cantidad_inicial: 2, costo_unitario: 5.4, fecha_vencimiento: enDias(1) }).select('id').single();
await admin.from('lotes').update({ fecha_vencimiento: enDias(-1) }).eq('id', lv.id);

// 4. Algunas ventas (FEFO en acción)
const ventas = [
  [[['Inca Kola 500 ml', 2], ['Galletas Soda Field', 3]], 'efectivo'],
  [[['Pan francés', 10], ['Huevos', 6], ['Leche Gloria azul 400 g', 1]], 'yape'],
  [[['Arroz Costeño a granel', 2.5], ['Azúcar rubia', 1], ['Aceite Primor 900 ml', 1]], 'efectivo'],
  [[['Coca-Cola 1.5 L', 1], ['Papas Lay’s clásicas', 2]], 'plin'],
];
for (const [items, metodo] of ventas) {
  const { error } = await dueno.rpc('registrar_venta', {
    p_items: items.map(([n, c]) => ({ producto_id: ids[n], cantidad: c })),
    p_metodo_pago: metodo,
  });
  if (error) falla('Venta de demo', error);
}

console.log('✓ Datos de demo cargados');
console.log(`  Dueño:    ${DUENO.email} / ${DUENO.password}`);
console.log(`  Ayudante: ${AYUDANTE.email} / ${AYUDANTE.password}`);
