-- =====================================================================
-- Caserito · Sprint 3 · HU13 (RF07)
-- CA1: lotes que vencen en los próximos N días (por defecto 7, configurable)
-- CA2: los lotes vencidos se muestran aparte y se registran como merma
-- =====================================================================

-- Días de anticipación con que el dueño quiere ver los lotes por vencer
alter table public.bodegas
  add column dias_aviso_vencimiento smallint not null default 7
  check (dias_aviso_vencimiento between 1 and 60);

-- Merma: producto que se pierde porque venció. Guarda el costo para medir la pérdida.
create table public.mermas (
  id              bigint generated always as identity primary key,
  bodega_id       uuid not null references public.bodegas (id) on delete cascade,
  lote_id         bigint not null references public.lotes (id),
  producto_id     bigint not null references public.productos (id),
  cantidad        numeric(12, 3) not null check (cantidad > 0),
  costo_unitario  numeric(10, 2) not null check (costo_unitario >= 0),
  costo_total     numeric(12, 2) not null check (costo_total >= 0),
  motivo          text not null default 'vencido' check (motivo in ('vencido')),
  usuario_id      uuid not null references public.perfiles (id),
  created_at      timestamptz not null default now()
);
create index mermas_bodega_fecha_idx on public.mermas (bodega_id, created_at desc);
-- Un lote vencido se da de baja una sola vez, con todo lo que le quedaba
create unique index mermas_un_registro_por_lote on public.mermas (lote_id);
comment on table public.mermas is 'Lotes vencidos dados de baja (HU13 CA2).';

alter table public.mermas enable row level security;

-- Solo el dueño ve las mermas (incluyen costos); se escriben únicamente con registrar_merma()
create policy "dueno ve mermas" on public.mermas
  for select to authenticated
  using (bodega_id = (select public.mi_bodega()) and (select public.es_dueno()));

revoke all on public.mermas from anon;
revoke insert, update, delete on public.mermas from authenticated;

-- ---------------------------------------------------------------------
-- HU13 CA2: registrar un lote vencido como merma (una sola transacción)
-- ---------------------------------------------------------------------
create or replace function public.registrar_merma(p_lote_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bodega  uuid;
  v_lote    record;
  v_merma   bigint;
  v_total   numeric(12, 2);
begin
  v_bodega := public.mi_bodega();
  if v_bodega is null or not public.es_dueno() then
    raise exception 'Solo el dueño puede registrar mermas' using errcode = '42501', hint = 'NO_AUTORIZADO';
  end if;

  select id, producto_id, cantidad_actual, costo_unitario, fecha_vencimiento into v_lote
  from public.lotes
  where id = p_lote_id and bodega_id = v_bodega
  for update;

  if not found then
    raise exception 'El lote no existe' using errcode = '22023', hint = 'LOTE_NO_EXISTE';
  end if;

  if v_lote.fecha_vencimiento >= public.hoy() then
    raise exception 'El lote todavía no vence: no se puede registrar como merma'
      using errcode = '22023', hint = 'LOTE_NO_VENCIDO';
  end if;

  if v_lote.cantidad_actual <= 0 then
    raise exception 'El lote ya no tiene unidades por registrar' using errcode = '22023', hint = 'LOTE_SIN_SALDO';
  end if;

  v_total := round(v_lote.cantidad_actual * v_lote.costo_unitario, 2);

  insert into public.mermas (bodega_id, lote_id, producto_id, cantidad, costo_unitario, costo_total, usuario_id)
  values (v_bodega, v_lote.id, v_lote.producto_id, v_lote.cantidad_actual, v_lote.costo_unitario, v_total, auth.uid())
  returning id into v_merma;

  update public.lotes set cantidad_actual = 0 where id = v_lote.id;

  return jsonb_build_object('merma_id', v_merma, 'cantidad', v_lote.cantidad_actual, 'costo_total', v_total);
end $$;

revoke execute on function public.registrar_merma(bigint) from public, anon;
grant execute on function public.registrar_merma(bigint) to authenticated;
