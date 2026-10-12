REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_role_is(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role) TO authenticated;