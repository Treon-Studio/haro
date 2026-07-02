-- ============================================================
-- FIX & SEED — Jalankan sekali di Supabase SQL Editor
-- ============================================================

-- 1. Create a public function to restart GoTrue connection
create or replace function public.fix_auth()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pid int;
  v_count int := 0;
begin
  for v_pid in select a.pid from pg_stat_activity a
               where a.pid <> pg_backend_pid()
                 and (a.application_name ilike '%gotrue%' or a.usename ilike '%authenticator%' or a.query ilike '%auth.users%')
  loop
    perform pg_terminate_backend(v_pid);
    v_count := v_count + 1;
    exit when v_count > 10;
  end loop;

  return 'Terminated ' || v_count || ' connections. GoTrue will reconnect automatically.';
end;
$$;

-- 2. Run it immediately so GoTrue reconnects
select public.fix_auth();
