-- Run this once in the Supabase SQL Editor for your new project.
--
-- This app has no public pages at all (unlike LornaEvans): every table is
-- readable/writable only by the single authenticated admin (Mai). Disable
-- public signup in Authentication settings and create her one login
-- manually from the Supabase dashboard (Authentication > Users > Add user).

create extension if not exists "pgcrypto";

-- ============================================================
-- pacientes
-- ============================================================
create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  telefono text,
  instagram text,
  created_at timestamptz not null default now()
);

alter table public.pacientes enable row level security;

create policy "auth manage pacientes" on public.pacientes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- tratamientos
-- ============================================================
create table public.tratamientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(12, 2) not null,
  descripcion text,
  -- soft delete: se oculta de los selectores pero no rompe turnos históricos
  -- que ya lo referencian desde turno_tratamientos
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tratamientos enable row level security;

create policy "auth manage tratamientos" on public.tratamientos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- turnos
-- ============================================================
create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  precio numeric(12, 2) not null,
  gift_card boolean not null default false,
  medio_pago text check (medio_pago in ('Efectivo', 'Transferencia', 'Credito', 'Debito')),
  -- "señado" sin ñ a propósito: evita problemas de identificadores no-ascii
  -- en SQL/código; la UI sigue mostrando "Señado".
  senado boolean not null default false,
  estado text not null default 'Agendado' check (estado in ('Finalizado', 'Agendado', 'Cancelado', 'Otro')),
  -- lo setea el bot de WhatsApp cuando el paciente responde "confirmar";
  -- no es parte del enum de estado porque esa lista la definió Mai y es fija.
  confirmado_paciente boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index turnos_fecha_idx on public.turnos (fecha);
create index turnos_paciente_id_idx on public.turnos (paciente_id);
create index turnos_estado_idx on public.turnos (estado);

alter table public.turnos enable row level security;

create policy "auth manage turnos" on public.turnos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger turnos_set_updated_at
  before update on public.turnos
  for each row execute function public.set_updated_at();

-- ============================================================
-- turno_tratamientos (join: un turno puede tener uno o más tratamientos)
-- ============================================================
create table public.turno_tratamientos (
  turno_id uuid not null references public.turnos(id) on delete cascade,
  tratamiento_id uuid not null references public.tratamientos(id) on delete restrict,
  -- snapshot del precio del tratamiento al momento de crear el turno, así
  -- un cambio de precio futuro no reescribe turnos pasados
  precio_aplicado numeric(12, 2) not null,
  primary key (turno_id, tratamiento_id)
);

alter table public.turno_tratamientos enable row level security;

create policy "auth manage turno_tratamientos" on public.turno_tratamientos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Crea o actualiza un turno junto con sus líneas de turno_tratamientos en una
-- sola transacción — evita que un turno quede a mitad de camino (creado pero
-- sin sus tratamientos) si el segundo insert fallara como llamadas separadas
-- desde el cliente. security invoker (default): corre con los permisos del
-- que llama, así que las policies de RLS de arriba se siguen aplicando.
create or replace function public.upsert_turno(
  p_id uuid,
  p_fecha timestamptz,
  p_paciente_id uuid,
  p_precio numeric,
  p_gift_card boolean,
  p_medio_pago text,
  p_senado boolean,
  p_estado text,
  p_tratamiento_ids uuid[],
  p_tratamiento_precios numeric[]
)
returns uuid
language plpgsql
as $$
declare
  v_turno_id uuid;
  i int;
begin
  if p_id is null then
    insert into public.turnos (fecha, paciente_id, precio, gift_card, medio_pago, senado, estado)
    values (p_fecha, p_paciente_id, p_precio, p_gift_card, p_medio_pago, p_senado, p_estado)
    returning id into v_turno_id;
  else
    update public.turnos set
      fecha = p_fecha,
      paciente_id = p_paciente_id,
      precio = p_precio,
      gift_card = p_gift_card,
      medio_pago = p_medio_pago,
      senado = p_senado,
      estado = p_estado
    where id = p_id
    returning id into v_turno_id;

    delete from public.turno_tratamientos where turno_id = v_turno_id;
  end if;

  for i in 1 .. coalesce(array_length(p_tratamiento_ids, 1), 0) loop
    insert into public.turno_tratamientos (turno_id, tratamiento_id, precio_aplicado)
    values (v_turno_id, p_tratamiento_ids[i], p_tratamiento_precios[i]);
  end loop;

  return v_turno_id;
end;
$$;

grant execute on function public.upsert_turno to authenticated;

-- ============================================================
-- notificaciones (las genera api/whatsapp-webhook.ts a partir de las
-- respuestas del paciente; las consume la campanita del header)
-- ============================================================
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid references public.turnos(id) on delete cascade,
  tipo text not null check (tipo in ('confirmado', 'cancelado', 'reprogramar', 'no_reconocido')),
  mensaje_original text,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificaciones_leida_idx on public.notificaciones (leida);

alter table public.notificaciones enable row level security;

create policy "auth manage notificaciones" on public.notificaciones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime: la campanita se suscribe a estos dos vía postgres_changes para
-- reflejar en vivo lo que hace el bot mientras Mai tiene la app abierta.
alter publication supabase_realtime add table public.notificaciones;
alter publication supabase_realtime add table public.turnos;

-- ============================================================
-- Auto-finalizar turnos vencidos
--
-- Esto es una migración incremental sobre el schema de arriba — si tu
-- proyecto ya corrió todo lo anterior, solo hace falta correr desde acá
-- para abajo en el SQL Editor.
--
-- Un turno pasa de 'Agendado' a 'Finalizado' solo cuando ya pasó 1 hora
-- desde su fecha — no hay forma de detectar esto "al vuelo" en el
-- frontend (nadie tiene por qué tener la app abierta en ese momento), así
-- que corre adentro de la base con pg_cron en vez de un cron de Vercel:
-- el plan Hobby de Vercel solo permite crons de una vez por día, muy poco
-- frecuente para esto.
-- ============================================================
create extension if not exists pg_cron;

create or replace function public.finalizar_turnos_vencidos()
returns void
language sql
security definer
set search_path = public
as $$
  update public.turnos
  set estado = 'Finalizado'
  where estado = 'Agendado'
    and fecha + interval '1 hour' <= now();
$$;

-- corre cada 15 minutos; cron.schedule con job_name hace upsert, así que
-- volver a correr este bloque no duplica el job
select cron.schedule(
  'finalizar-turnos-vencidos',
  '*/15 * * * *',
  $$ select public.finalizar_turnos_vencidos(); $$
);

-- ============================================================
-- Google Calendar
--
-- Migración incremental — correr solo esto si el resto del schema ya
-- estaba aplicado.
--
-- email: opcional, se usa para invitar al paciente como asistente del
-- evento de Google Calendar (si no lo carga, el turno igual se agrega al
-- calendario de Mai, solo no se invita a nadie más).
-- google_event_id: el id del evento en Google Calendar correspondiente a
-- este turno, para poder editarlo/borrarlo en vez de duplicarlo cada vez
-- que se guarda (ver api/sync-calendar.ts).
-- ============================================================
alter table public.pacientes add column if not exists email text;
alter table public.turnos add column if not exists google_event_id text;

-- ============================================================
-- Seña como tratamiento especial
--
-- Migración incremental — correr solo esto si el resto del schema ya
-- estaba aplicado.
--
-- es_sena: marca el tratamiento que representa el monto de seña. Se
-- configura desde la pantalla de Tratamientos como uno más (mismo nombre,
-- precio, activo/inactivo), pero el formulario de Nuevo Turno lo excluye
-- del selector — no es algo que se le realice a un paciente — y los
-- cálculos de precio promedio para balances futuros también lo excluyen.
-- El índice único parcial asegura que haya como mucho uno marcado, ya que
-- el código asume eso al buscarlo.
-- ============================================================
alter table public.tratamientos add column if not exists es_sena boolean not null default false;

create unique index if not exists tratamientos_es_sena_unique
  on public.tratamientos (es_sena)
  where es_sena;

-- ============================================================
-- Conexión de Google Calendar
--
-- Migración incremental — correr solo esto si el resto del schema ya
-- estaba aplicado.
--
-- Guarda el refresh token que antes vivía en la env var
-- GOOGLE_CALENDAR_REFRESH_TOKEN, para que conectar el calendario sea un
-- botón dentro de la app (ver api/google-oauth-callback.ts) en vez de un
-- paso manual de copiar/pegar en Vercel + redeploy. Fila única (id fijo en
-- 1): esta app es de un solo admin, no hace falta una tabla de múltiples
-- conexiones. Sin policies de RLS a propósito — RLS habilitado sin ninguna
-- policy deniega todo a anon/authenticated, así que solo el service role
-- (server/supabaseAdmin.ts) puede leer o escribir acá; el refresh token
-- nunca debe ser alcanzable desde el cliente.
-- ============================================================
create table public.google_calendar_conexion (
  id smallint primary key default 1,
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  constraint google_calendar_conexion_single_row check (id = 1)
);

alter table public.google_calendar_conexion enable row level security;

-- ============================================================
-- Notas en pacientes y turnos
--
-- Migración incremental — correr solo esto si el resto del schema ya
-- estaba aplicado.
--
-- Dos notas independientes, no una sola: una nota de turno documenta algo
-- puntual de esa sesión (ej. "se fue con roncha, avisar si vuelve"), una
-- nota de paciente es algo que aplica siempre (ej. "alérgica al latex").
-- El perfil del paciente (PacienteDetalle.tsx) muestra la del paciente
-- arriba y la de cada turno dentro de su propia tarjeta.
-- ============================================================
alter table public.pacientes add column if not exists notas text;
alter table public.turnos add column if not exists notas text;

-- upsert_turno necesita el parámetro nuevo — se borra la versión vieja (10
-- parámetros) para no dejar dos funciones sobrecargadas conviviendo.
drop function if exists public.upsert_turno(uuid, timestamptz, uuid, numeric, boolean, text, boolean, text, uuid[], numeric[]);

create or replace function public.upsert_turno(
  p_id uuid,
  p_fecha timestamptz,
  p_paciente_id uuid,
  p_precio numeric,
  p_gift_card boolean,
  p_medio_pago text,
  p_senado boolean,
  p_estado text,
  p_tratamiento_ids uuid[],
  p_tratamiento_precios numeric[],
  p_notas text
)
returns uuid
language plpgsql
as $$
declare
  v_turno_id uuid;
  i int;
begin
  if p_id is null then
    insert into public.turnos (fecha, paciente_id, precio, gift_card, medio_pago, senado, estado, notas)
    values (p_fecha, p_paciente_id, p_precio, p_gift_card, p_medio_pago, p_senado, p_estado, p_notas)
    returning id into v_turno_id;
  else
    update public.turnos set
      fecha = p_fecha,
      paciente_id = p_paciente_id,
      precio = p_precio,
      gift_card = p_gift_card,
      medio_pago = p_medio_pago,
      senado = p_senado,
      estado = p_estado,
      notas = p_notas
    where id = p_id
    returning id into v_turno_id;

    delete from public.turno_tratamientos where turno_id = v_turno_id;
  end if;

  for i in 1 .. coalesce(array_length(p_tratamiento_ids, 1), 0) loop
    insert into public.turno_tratamientos (turno_id, tratamiento_id, precio_aplicado)
    values (v_turno_id, p_tratamiento_ids[i], p_tratamiento_precios[i]);
  end loop;

  return v_turno_id;
end;
$$;

grant execute on function public.upsert_turno to authenticated;

-- ============================================================
-- Formularios (respuestas del Google Form previo al turno)
--
-- Migración incremental. api/google-form-webhook.ts inserta cada respuesta
-- siempre con paciente_id null — el matching es manual, Mai ya lo hacía a
-- mano en la app vieja (no hay forma confiable de correlacionar automático:
-- el teléfono que el paciente escribe en el form no tiene por qué coincidir
-- en formato con pacientes.telefono). google_response_id evita duplicar la
-- fila si Apps Script reintenta el POST.
-- ============================================================
create table public.respuestas_formulario (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id),
  google_response_id text unique,
  respuestas jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.respuestas_formulario enable row level security;

create policy "auth manage respuestas_formulario" on public.respuestas_formulario for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.respuestas_formulario;

-- Tipo nuevo para avisar "llegó un formulario nuevo sin asignar" — usa
-- turno_id null y mensaje_original con el nombre que puso el paciente en el
-- form (no hace falta una columna nueva: la asignación a un paciente
-- concreto vive en respuestas_formulario.paciente_id, no acá). El check
-- constraint se recrea entero porque Postgres no tiene un "add value" para
-- checks (a diferencia de un enum de verdad).
alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('confirmado', 'cancelado', 'reprogramar', 'no_reconocido', 'formulario_nuevo'));
