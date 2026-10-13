-- =====================================================================
-- Caserito · Sprint 1 (HT01, HU01–HU07)
-- RF01 Registro e inicio de sesión con roles
-- RF02 Inventario con lotes y fechas de vencimiento
-- RF03 Registro de ventas con descuento automático de stock (FEFO)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos y utilidades
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('dueno', 'ayudante');

-- Fecha de hoy en Lima (Supabase trabaja en UTC; a las 7 p. m. de Lima ya es "mañana" en UTC)
create or replace function public.hoy()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Lima')::date $$;

-- Unidades que se venden fraccionadas; el resto solo admite cantidades enteras
create or replace function public.unidad_fraccionable(p_unidad text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_unidad in ('kg', 'litro') $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.bodegas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 100),
  direccion   text not null check (char_length(btrim(direccion)) between 3 and 200),
  created_at  timestamptz not null default now()
);
comment on table public.bodegas is 'Cada bodega es un inquilino (tenant): solo ve sus propios datos.';

create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  bodega_id   uuid not null references public.bodegas (id) on delete cascade,
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 100),
  email       text not null,
  rol         public.rol_usuario not null,
  created_at  timestamptz not null default now()
);
create unique index perfiles_un_dueno_por_bodega on public.perfiles (bodega_id) where rol = 'dueno';
create index perfiles_bodega_idx on public.perfiles (bodega_id);
comment on table public.perfiles is 'Usuario del sistema dentro de una bodega, con su rol (HU01, HU03).';

-- Funciones de seguridad usadas por las políticas RLS.
-- SECURITY DEFINER evita la recursión de RLS al consultar perfiles.
create or replace function public.mi_bodega()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select bodega_id from public.perfiles where id = auth.uid() $$;

create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'dueno') $$;

create table public.categorias (
  id          bigint generated always as identity primary key,
  bodega_id   uuid not null default public.mi_bodega() references public.bodegas (id) on delete cascade,
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 60),
  unique (bodega_id, nombre),
  unique (id, bodega_id)
);

create table public.productos (
  id            bigint generated always as identity primary key,
  bodega_id     uuid not null default public.mi_bodega() references public.bodegas (id) on delete cascade,
  categoria_id  bigint not null,
  nombre        text not null check (char_length(btrim(nombre)) between 2 and 120),
  unidad        text not null check (unidad in ('unidad', 'paquete', 'botella', 'lata', 'caja', 'bolsa', 'kg', 'litro')),
  precio_venta  numeric(10, 2) not null check (precio_venta > 0),
  stock_minimo  numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, bodega_id),
  foreign key (categoria_id, bodega_id) references public.categorias (id, bodega_id)
);
-- HU04 CA2: no se repite el nombre del producto dentro de la misma bodega
create unique index productos_nombre_unico on public.productos (bodega_id, lower(btrim(nombre)));

create table public.lotes (
  id                 bigint generated always as identity primary key,
  bodega_id          uuid not null default public.mi_bodega() references public.bodegas (id) on delete cascade,
  producto_id        bigint not null,
  cantidad_inicial   numeric(12, 3) not null check (cantidad_inicial > 0),
  cantidad_actual    numeric(12, 3) not null check (cantidad_actual >= 0 and cantidad_actual <= cantidad_inicial),
  costo_unitario     numeric(10, 2) not null check (costo_unitario >= 0),
  fecha_vencimiento  date not null,
  creado_por         uuid default auth.uid() references public.perfiles (id),
  created_at         timestamptz not null default now(),
  foreign key (producto_id, bodega_id) references public.productos (id, bodega_id)
);
create index lotes_fefo_idx on public.lotes (producto_id, fecha_vencimiento, id) where cantidad_actual > 0;
comment on table public.lotes is 'Ingreso de mercadería por lote con fecha de vencimiento (HU05).';

create table public.ventas (
  id           bigint generated always as identity primary key,
  bodega_id    uuid not null references public.bodegas (id) on delete cascade,
  usuario_id   uuid not null references public.perfiles (id),
  total        numeric(12, 2) not null check (total >= 0),
  metodo_pago  text not null default 'efectivo' check (metodo_pago in ('efectivo', 'yape', 'plin', 'tarjeta', 'otro')),
  created_at   timestamptz not null default now()
);
create index ventas_bodega_fecha_idx on public.ventas (bodega_id, created_at desc);

create table public.venta_detalle (
  id               bigint generated always as identity primary key,
  venta_id         bigint not null references public.ventas (id) on delete cascade,
  bodega_id        uuid not null references public.bodegas (id) on delete cascade,
  producto_id      bigint not null references public.productos (id),
  cantidad         numeric(12, 3) not null check (cantidad > 0),
  precio_unitario  numeric(10, 2) not null check (precio_unitario > 0),
  subtotal         numeric(12, 2) not null check (subtotal >= 0)
);
create index venta_detalle_venta_idx on public.venta_detalle (venta_id);

-- De qué lote salió cada unidad vendida (evidencia del criterio FEFO)
create table public.venta_detalle_lotes (
  detalle_id  bigint not null references public.venta_detalle (id) on delete cascade,
  lote_id     bigint not null references public.lotes (id),
  bodega_id   uuid not null references public.bodegas (id) on delete cascade,
  cantidad    numeric(12, 3) not null check (cantidad > 0),
  primary key (detalle_id, lote_id)
);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Categorías iniciales para cada bodega nueva
create or replace function public.crear_categorias_iniciales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (bodega_id, nombre)
  select new.id, c
  from unnest(array['Abarrotes', 'Bebidas', 'Lácteos', 'Snacks y golosinas', 'Panadería',
                    'Limpieza', 'Cuidado personal', 'Otros']) as c;
  return new;
end $$;

create trigger bodegas_categorias_iniciales
after insert on public.bodegas
for each row execute function public.crear_categorias_iniciales();

-- HU01: al registrarse un dueño se crean su bodega y su perfil.
-- Solo actúa si el registro trae "nombre_bodega"; las cuentas de ayudante
-- las crea el servidor (HU03) y su perfil se inserta con la clave de servicio.
create or replace function public.registrar_dueno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bodega uuid;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if nullif(btrim(v_meta ->> 'nombre_bodega'), '') is null then
    return new;
  end if;

  insert into public.bodegas (nombre, direccion)
  values (btrim(v_meta ->> 'nombre_bodega'), coalesce(nullif(btrim(v_meta ->> 'direccion'), ''), 'Sin dirección'))
  returning id into v_bodega;

  insert into public.perfiles (id, bodega_id, nombre, email, rol)
  values (new.id, v_bodega,
          coalesce(nullif(btrim(v_meta ->> 'nombre'), ''), split_part(new.email, '@', 1)),
          new.email, 'dueno');
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.registrar_dueno();

-- HU04: mantener updated_at
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger productos_updated_at
before update on public.productos
for each row execute function public.tocar_updated_at();

-- HU05: validaciones del lote
create or replace function public.validar_lote()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_unidad text;
begin
  if new.fecha_vencimiento < public.hoy() then
    raise exception 'La fecha de vencimiento no puede ser anterior a hoy'
      using errcode = '23514', hint = 'FECHA_VENCIDA';
  end if;

  select unidad into v_unidad from public.productos where id = new.producto_id;
  if not public.unidad_fraccionable(v_unidad) and new.cantidad_inicial <> trunc(new.cantidad_inicial) then
    raise exception 'La cantidad debe ser un número entero para productos vendidos por %', v_unidad
      using errcode = '23514', hint = 'CANTIDAD_NO_ENTERA';
  end if;

  -- Un lote siempre nace completo; su saldo solo cambia con ventas
  new.cantidad_actual := new.cantidad_inicial;
  return new;
end $$;

create trigger lotes_validar
before insert on public.lotes
for each row execute function public.validar_lote();

-- ---------------------------------------------------------------------
-- HU07: registrar venta (una sola transacción, descuento FEFO)
-- p_items: [{"producto_id": 1, "cantidad": 2}, ...]
-- ---------------------------------------------------------------------
create or replace function public.registrar_venta(p_items jsonb, p_metodo_pago text default 'efectivo')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bodega    uuid;
  v_venta     bigint;
  v_detalle   bigint;
  v_total     numeric(12, 2) := 0;
  v_subtotal  numeric(12, 2);
  v_item      record;
  v_prod      record;
  v_lote      record;
  v_disp      numeric;
  v_restante  numeric;
  v_toma      numeric;
begin
  v_bodega := public.mi_bodega();
  if v_bodega is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos' using errcode = '22023', hint = 'VENTA_VACIA';
  end if;

  insert into public.ventas (bodega_id, usuario_id, total, metodo_pago)
  values (v_bodega, auth.uid(), 0, coalesce(p_metodo_pago, 'efectivo'))
  returning id into v_venta;

  -- Si el mismo producto viene dos veces se suma; el orden fijo evita bloqueos cruzados
  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id,
           sum((e ->> 'cantidad')::numeric) as cantidad
    from jsonb_array_elements(p_items) as e
    group by 1
    order by 1
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'La cantidad debe ser mayor a cero' using errcode = '22023', hint = 'CANTIDAD_INVALIDA';
    end if;

    select id, nombre, unidad, precio_venta into v_prod
    from public.productos
    where id = v_item.producto_id and bodega_id = v_bodega and activo;

    if not found then
      raise exception 'Producto no encontrado' using errcode = '22023', hint = 'PRODUCTO_NO_EXISTE';
    end if;

    if not public.unidad_fraccionable(v_prod.unidad) and v_item.cantidad <> trunc(v_item.cantidad) then
      raise exception 'La cantidad de "%" debe ser un número entero', v_prod.nombre
        using errcode = '22023', hint = 'CANTIDAD_NO_ENTERA';
    end if;

    -- Bloquea los lotes vigentes del producto mientras dura la venta
    perform 1 from public.lotes
    where producto_id = v_prod.id and bodega_id = v_bodega
      and cantidad_actual > 0 and fecha_vencimiento >= public.hoy()
    for update;

    select coalesce(sum(cantidad_actual), 0) into v_disp
    from public.lotes
    where producto_id = v_prod.id and bodega_id = v_bodega
      and cantidad_actual > 0 and fecha_vencimiento >= public.hoy();

    if v_disp < v_item.cantidad then
      raise exception 'Stock insuficiente para "%": disponible %', v_prod.nombre, trim_scale(v_disp)
        using errcode = 'P0001', hint = 'STOCK_INSUFICIENTE';
    end if;

    v_subtotal := round(v_item.cantidad * v_prod.precio_venta, 2);

    insert into public.venta_detalle (venta_id, bodega_id, producto_id, cantidad, precio_unitario, subtotal)
    values (v_venta, v_bodega, v_prod.id, v_item.cantidad, v_prod.precio_venta, v_subtotal)
    returning id into v_detalle;

    -- FEFO: primero en vencer, primero en salir
    v_restante := v_item.cantidad;
    for v_lote in
      select id, cantidad_actual
      from public.lotes
      where producto_id = v_prod.id and bodega_id = v_bodega
        and cantidad_actual > 0 and fecha_vencimiento >= public.hoy()
      order by fecha_vencimiento, id
    loop
      exit when v_restante <= 0;
      v_toma := least(v_lote.cantidad_actual, v_restante);

      update public.lotes set cantidad_actual = cantidad_actual - v_toma where id = v_lote.id;
      insert into public.venta_detalle_lotes (detalle_id, lote_id, bodega_id, cantidad)
      values (v_detalle, v_lote.id, v_bodega, v_toma);

      v_restante := v_restante - v_toma;
    end loop;

    v_total := v_total + v_subtotal;
  end loop;

  update public.ventas set total = v_total where id = v_venta;

  return jsonb_build_object('venta_id', v_venta, 'total', v_total);
end $$;

-- ---------------------------------------------------------------------
-- Vistas de consulta (HU06)
-- Se ejecutan con permisos del propietario y filtran explícitamente por
-- la bodega del usuario; así el ayudante ve los lotes sin ver el costo.
-- ---------------------------------------------------------------------
create view public.v_lotes as
select l.id,
       l.bodega_id,
       l.producto_id,
       l.cantidad_inicial,
       l.cantidad_actual,
       l.fecha_vencimiento,
       (l.fecha_vencimiento < public.hoy()) as vencido,
       l.created_at
from public.lotes l
where l.bodega_id = public.mi_bodega();

create view public.v_stock as
select p.id            as producto_id,
       p.bodega_id,
       p.nombre,
       p.unidad,
       p.precio_venta,
       p.stock_minimo,
       p.activo,
       p.categoria_id,
       c.nombre        as categoria,
       coalesce(sum(l.cantidad_actual) filter (where l.fecha_vencimiento >= public.hoy()), 0) as stock_disponible,
       coalesce(sum(l.cantidad_actual) filter (where l.fecha_vencimiento <  public.hoy()), 0) as stock_vencido,
       min(l.fecha_vencimiento) filter (where l.cantidad_actual > 0 and l.fecha_vencimiento >= public.hoy()) as proximo_vencimiento
from public.productos p
join public.categorias c on c.id = p.categoria_id
left join public.lotes l on l.producto_id = p.id
where p.bodega_id = public.mi_bodega()
group by p.id, c.nombre;

-- ---------------------------------------------------------------------
-- Seguridad: Row Level Security (HU03 CA2 y CA3)
-- ---------------------------------------------------------------------
alter table public.bodegas             enable row level security;
alter table public.perfiles            enable row level security;
alter table public.categorias          enable row level security;
alter table public.productos           enable row level security;
alter table public.lotes               enable row level security;
alter table public.ventas              enable row level security;
alter table public.venta_detalle       enable row level security;
alter table public.venta_detalle_lotes enable row level security;

-- Bodegas
create policy "miembros ven su bodega" on public.bodegas
  for select to authenticated using (id = (select public.mi_bodega()));
create policy "dueno edita su bodega" on public.bodegas
  for update to authenticated
  using (id = (select public.mi_bodega()) and (select public.es_dueno()))
  with check (id = (select public.mi_bodega()));

-- Perfiles (las altas las hace el trigger o el servidor con la clave de servicio)
create policy "miembros ven perfiles de su bodega" on public.perfiles
  for select to authenticated using (bodega_id = (select public.mi_bodega()));

-- Categorías
create policy "miembros ven categorias" on public.categorias
  for select to authenticated using (bodega_id = (select public.mi_bodega()));
create policy "dueno crea categorias" on public.categorias
  for insert to authenticated
  with check (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()));

-- Productos: todos los ven (para vender); solo el dueño crea o cambia precios
create policy "miembros ven productos" on public.productos
  for select to authenticated using (bodega_id = (select public.mi_bodega()));
create policy "dueno crea productos" on public.productos
  for insert to authenticated
  with check (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()));
create policy "dueno edita productos" on public.productos
  for update to authenticated
  using (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()))
  with check (bodega_id = (select public.mi_bodega()));

-- Lotes: la tabla (con costos) solo la ve y llena el dueño; el ayudante usa v_lotes
create policy "dueno ve lotes" on public.lotes
  for select to authenticated
  using (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()));
create policy "dueno registra lotes" on public.lotes
  for insert to authenticated
  with check (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()));

-- Ventas: solo lectura; se escriben únicamente con registrar_venta()
create policy "miembros ven ventas" on public.ventas
  for select to authenticated using (bodega_id = (select public.mi_bodega()));
create policy "miembros ven detalle" on public.venta_detalle
  for select to authenticated using (bodega_id = (select public.mi_bodega()));
create policy "miembros ven detalle por lote" on public.venta_detalle_lotes
  for select to authenticated using (bodega_id = (select public.mi_bodega()));

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
-- Las vistas simples son actualizables: se dejan solo de lectura
revoke all on public.v_lotes, public.v_stock from anon, authenticated;
grant select on public.v_lotes, public.v_stock to authenticated;

-- Nadie anónimo toca las tablas
revoke all on all tables in schema public from anon;

-- La venta solo la ejecuta un usuario con sesión
revoke execute on function public.registrar_venta(jsonb, text) from public, anon;
grant execute on function public.registrar_venta(jsonb, text) to authenticated;

-- Funciones internas de triggers: fuera del alcance de la API
revoke execute on function public.registrar_dueno() from public, anon, authenticated;
revoke execute on function public.crear_categorias_iniciales() from public, anon, authenticated;
revoke execute on function public.validar_lote() from public, anon, authenticated;
revoke execute on function public.tocar_updated_at() from public, anon, authenticated;
