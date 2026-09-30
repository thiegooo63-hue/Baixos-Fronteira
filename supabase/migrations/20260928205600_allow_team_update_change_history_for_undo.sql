drop policy if exists "team can update change history" on public.change_history;
create policy "team can update change history" on public.change_history
for update to authenticated
using (app_private.is_team_member())
with check (app_private.is_team_member());
