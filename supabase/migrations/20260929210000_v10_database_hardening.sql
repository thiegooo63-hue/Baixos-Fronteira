-- V10 final: índices de FKs e otimização da policy de histórico
create index if not exists admin_backups_user_id_idx on public.admin_backups(user_id);
create index if not exists change_history_backup_id_idx on public.change_history(backup_id);
create index if not exists change_history_undone_by_idx on public.change_history(undone_by);
create index if not exists change_history_user_id_idx on public.change_history(user_id);
create index if not exists sponsors_created_by_idx on public.sponsors(created_by);

drop policy if exists "team can create change history" on public.change_history;
create policy "team can create change history"
on public.change_history for insert to authenticated
with check (
  app_private.is_team_member()
  and (user_id is null or user_id = (select auth.uid()))
);
