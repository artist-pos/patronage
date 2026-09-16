-- Fixed-window rate limiter shared by signup, activation enquiries, and bug
-- reports (bot-farmed signups were flooding these — see hello@patronage.nz
-- Sep 2026). Keyed by an arbitrary "<action>:<ip>" string. Only the admin
-- (service-role) client ever touches this table, so RLS stays enabled with
-- no policies at all — anon/authenticated requests can't read or write it
-- via PostgREST even by accident.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Opportunistic cleanup so the table doesn't grow unbounded — cheap, no
  -- separate cron needed at this volume.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  insert into rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
