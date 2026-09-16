-- 079's two collective_members policies each subquery collective_members
-- from within their own USING clause ("am I a member of a collective that
-- has a row where I'm a member") — Postgres re-evaluates RLS on the table
-- for that inner subquery, which re-enters the same policy, forever
-- (42P17 infinite recursion). Standard fix: move the self-check into a
-- SECURITY DEFINER function, whose internal query runs as the function
-- owner and so isn't subject to collective_members' own RLS.

create or replace function public.is_collective_member(p_collective_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from collective_members
    where collective_id = p_collective_id and user_id = p_user_id
  );
$$;

create or replace function public.is_collective_admin(p_collective_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from collective_members
    where collective_id = p_collective_id and user_id = p_user_id and role = 'admin'
  );
$$;

grant execute on function public.is_collective_member(uuid, uuid) to authenticated;
grant execute on function public.is_collective_admin(uuid, uuid) to authenticated;

drop policy if exists "Members can view their collective memberships" on public.collective_members;
create policy "Members can view their collective memberships"
  on public.collective_members for select
  using (
    user_id = auth.uid()
    or public.is_collective_member(collective_id, auth.uid())
  );

drop policy if exists "Admins can manage collective members" on public.collective_members;
create policy "Admins can manage collective members"
  on public.collective_members for all
  using (
    public.is_collective_admin(collective_id, auth.uid())
  );
