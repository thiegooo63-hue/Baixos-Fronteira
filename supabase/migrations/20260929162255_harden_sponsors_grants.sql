revoke insert, update, delete, truncate, references, trigger on table public.sponsors from anon;
revoke truncate, references, trigger on table public.sponsors from authenticated;
revoke all on sequence public.sponsors_id_seq from anon;
grant select on table public.sponsors to anon;
grant select, insert, update, delete on table public.sponsors to authenticated;
grant select, usage on sequence public.sponsors_id_seq to authenticated;
