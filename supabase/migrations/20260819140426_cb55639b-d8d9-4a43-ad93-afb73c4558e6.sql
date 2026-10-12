REVOKE ALL ON FUNCTION public.dispatch_help_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_help_request_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;