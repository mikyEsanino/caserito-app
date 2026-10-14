-- =====================================================================
-- Caserito · Redondeo a favor del consumidor en pagos en efectivo
-- Código de Protección y Defensa del Consumidor (Ley 29571), art. 44:
-- cuando se paga en efectivo, el redondeo se hace siempre hacia abajo.
-- Ej.: S/ 36.54 → se cobra S/ 36.50.
-- Los pagos con Yape, Plin, tarjeta u otro se cobran exactos.
-- =====================================================================

-- ventas.total queda como la suma exacta de los productos;
-- ventas.total_cobrado es lo que realmente paga el cliente.
alter table public.ventas add column total_cobrado numeric(12, 2) not null default 0;
update public.ventas
set total_cobrado = case when metodo_pago = 'efectivo' then floor(total * 10) / 10 else total end;
alter table public.ventas
  add constraint ventas_total_cobrado_valido check (total_cobrado >= 0 and total_cobrado <= total);

comment on column public.ventas.total is 'Suma exacta de los subtotales';
comment on column public.ventas.total_cobrado is 'Monto cobrado: en efectivo se redondea hacia abajo a múltiplos de S/ 0.10 (art. 44, Ley 29571)';

create or replace function public.redondeo_efectivo(p_total numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$ select floor(p_total * 10) / 10 $$;

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
  v_metodo    text := coalesce(p_metodo_pago, 'efectivo');
  v_total     numeric(12, 2) := 0;
  v_cobrado   numeric(12, 2);
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

  insert into public.ventas (bodega_id, usuario_id, total, total_cobrado, metodo_pago)
  values (v_bodega, auth.uid(), 0, 0, v_metodo)
  returning id into v_venta;

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

  -- Redondeo a favor del cliente solo en efectivo (art. 44, Ley 29571)
  v_cobrado := case when v_metodo = 'efectivo' then public.redondeo_efectivo(v_total) else v_total end;

  update public.ventas set total = v_total, total_cobrado = v_cobrado where id = v_venta;

  return jsonb_build_object(
    'venta_id', v_venta,
    'total', v_total,
    'total_cobrado', v_cobrado,
    'redondeo', v_total - v_cobrado
  );
end $$;

revoke execute on function public.registrar_venta(jsonb, text) from public, anon;
grant execute on function public.registrar_venta(jsonb, text) to authenticated;
