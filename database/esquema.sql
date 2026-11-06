-- AdoptaMath - esquema de base de datos para Supabase
-- Ejecuta este archivo en Supabase > SQL Editor.
-- Si ya creaste estas tablas, no es necesario volver a ejecutarlo.

create table if not exists public.simulaciones (
  id bigint generated always as identity primary key,
  nombre text not null,
  adopciones_iniciales numeric not null check (adopciones_iniciales >= 0),
  meta_maxima numeric not null check (meta_maxima > 0),
  tasa_adopcion numeric not null check (tasa_adopcion > 0),
  tiempo_final numeric not null check (tiempo_final > 0),
  created_at timestamptz not null default now(),
  constraint adopciones_no_superan_meta check (adopciones_iniciales <= meta_maxima)
);

create table if not exists public.resultados (
  id bigint generated always as identity primary key,
  simulacion_id bigint not null references public.simulaciones(id) on delete cascade,
  metodo text not null check (metodo in ('Heun', 'RK4')),
  paso numeric not null check (paso > 0),
  datos jsonb not null,
  created_at timestamptz not null default now()
);

-- Impide repetir un mismo método con el mismo paso dentro de un experimento.
create unique index if not exists resultados_unicos_por_metodo_y_paso
on public.resultados (simulacion_id, metodo, paso);

alter table public.simulaciones enable row level security;
alter table public.resultados enable row level security;

-- Políticas para un prototipo académico público.
-- Cualquier visitante con la clave publishable puede leer e insertar.
-- Antes de usar con datos reales, implementar autenticación y políticas por usuario.
drop policy if exists "Consultar simulaciones" on public.simulaciones;
drop policy if exists "Guardar simulaciones" on public.simulaciones;
drop policy if exists "Consultar resultados" on public.resultados;
drop policy if exists "Guardar resultados" on public.resultados;

create policy "Consultar simulaciones"
on public.simulaciones for select to anon using (true);

create policy "Guardar simulaciones"
on public.simulaciones for insert to anon with check (true);

create policy "Consultar resultados"
on public.resultados for select to anon using (true);

create policy "Guardar resultados"
on public.resultados for insert to anon with check (true);

-- Comprueba que las tablas existen:
-- select * from public.simulaciones;
-- select * from public.resultados;
