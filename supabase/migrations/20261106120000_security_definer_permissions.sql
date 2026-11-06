-- Fuerza y Ritmo / Supabase project entreno-semanal
-- Reviewed migration; do not run until the associated code branch is reviewed.
-- No row data is modified or deleted.
begin;

-- Functions called by the authenticated client or by RLS policies.
revoke execute on function public.accesos_admin() from public, anon;
grant execute on function public.accesos_admin() to authenticated;

revoke execute on function public.edita_catalogo() from public, anon;
grant execute on function public.edita_catalogo() to authenticated;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

revoke execute on function public.es_aprobado() from public, anon;
grant execute on function public.es_aprobado() to authenticated;

revoke execute on function public.marcar_novedades(text) from public, anon;
grant execute on function public.marcar_novedades(text) to authenticated;

revoke execute on function public.registrar_acceso(text, text) from public, anon;
grant execute on function public.registrar_acceso(text, text) to authenticated;

revoke execute on function public.ver_compartido(text) from public, anon;
grant execute on function public.ver_compartido(text) to authenticated;

-- Trigger/event-trigger functions are not client RPC entry points.
revoke execute on function public.avisar_registro(text) from public, anon, authenticated;
revoke execute on function public.avisar_sugerencia() from public, anon, authenticated;
revoke execute on function public.nuevo_perfil() from public, anon, authenticated;
revoke execute on function public.proteger_catalogo() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Pin search_path for reviewed SECURITY DEFINER bodies that schema-qualify
-- application relations and helpers.
alter function public.accesos_admin() set search_path = '';
alter function public.edita_catalogo() set search_path = '';
alter function public.es_admin() set search_path = '';
alter function public.es_aprobado() set search_path = '';
alter function public.marcar_novedades(text) set search_path = '';
alter function public.registrar_acceso(text, text) set search_path = '';
alter function public.ver_compartido(text) set search_path = '';

commit;
