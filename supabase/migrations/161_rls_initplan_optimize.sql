-- Supabase linter 0003_auth_rls_initplan.
--
-- RLS policies that call auth.uid()/auth.role()/auth.jwt()/auth.email() or
-- current_setting() re-evaluate those functions once PER ROW. Wrapping each call
-- in a scalar subquery — (select auth.uid()) — lets Postgres evaluate it ONCE per
-- query (an InitPlan) and reuse the result for every row.
--
-- This is a SEMANTICS-PRESERVING change. (select auth.uid()) returns the identical
-- value to auth.uid(); only the evaluation timing changes. No policy's access
-- decision is altered — so this improves performance without affecting safety.
--
-- HOW IT WORKS: we read each policy's CURRENT definition straight from pg_policies
-- (the live source of truth, so we never use a stale copy), normalise then wrap the
-- auth/current_setting calls, and DROP + CREATE the policy with otherwise identical
-- attributes (permissive/restrictive, roles, command, USING, WITH CHECK).
--
-- SAFETY: the entire loop runs in one DO block / one transaction. If ANY policy
-- fails to rebuild, the whole migration rolls back — there is no partial state and
-- no window where a policy is missing after commit. Re-running is a no-op
-- (idempotent): already-wrapped calls are normalised before re-wrapping.

do $$
declare
  r       record;
  q       text;
  c       text;
  stmt    text;
  roles_csv text;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
            coalesce(qual, '')       ~* '(auth\.(uid|role|jwt|email)\(\)|current_setting\()'
         or coalesce(with_check, '') ~* '(auth\.(uid|role|jwt|email)\(\)|current_setting\()'
      )
  loop
    q := r.qual;
    c := r.with_check;

    -- USING expression: unwrap any existing (select …) wraps, then wrap all calls.
    if q is not null then
      q := regexp_replace(q, '\(\s*select\s+(auth\.(uid|role|jwt|email)\(\))\s*\)', '\1', 'gi');
      q := regexp_replace(q, '\(\s*select\s+(current_setting\([^)]*\))\s*\)',        '\1', 'gi');
      q := regexp_replace(q, '(auth\.(uid|role|jwt|email)\(\))', '(select \1)', 'gi');
      q := regexp_replace(q, '(current_setting\([^)]*\))',       '(select \1)', 'gi');
    end if;

    -- WITH CHECK expression: same treatment.
    if c is not null then
      c := regexp_replace(c, '\(\s*select\s+(auth\.(uid|role|jwt|email)\(\))\s*\)', '\1', 'gi');
      c := regexp_replace(c, '\(\s*select\s+(current_setting\([^)]*\))\s*\)',        '\1', 'gi');
      c := regexp_replace(c, '(auth\.(uid|role|jwt|email)\(\))', '(select \1)', 'gi');
      c := regexp_replace(c, '(current_setting\([^)]*\))',       '(select \1)', 'gi');
    end if;

    -- Rebuild the TO role list (quoted identifiers).
    select string_agg(format('%I', role_name), ', ')
      into roles_csv
      from unnest(r.roles) as role_name;

    execute format('drop policy %I on %I.%I;', r.policyname, r.schemaname, r.tablename);

    stmt := format('create policy %I on %I.%I as %s for %s to %s',
                   r.policyname, r.schemaname, r.tablename,
                   r.permissive, r.cmd, roles_csv);
    if q is not null then
      stmt := stmt || format(' using (%s)', q);
    end if;
    if c is not null then
      stmt := stmt || format(' with check (%s)', c);
    end if;

    execute stmt;
  end loop;
end $$;
