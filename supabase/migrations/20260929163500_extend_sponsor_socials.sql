alter table public.sponsors
  add column if not exists social_handle text,
  add column if not exists threads_url text,
  add column if not exists threads_handle text,
  add column if not exists youtube_url text,
  add column if not exists facebook_url text,
  add column if not exists x_url text;

update public.sponsors
set social_handle = coalesce(nullif(trim(instagram_handle), ''), nullif(trim(tiktok_handle), ''))
where social_handle is null or trim(social_handle) = '';

update public.sponsors
set instagram_handle = case when social_handle is not null and trim(social_handle) <> '' then social_handle else instagram_handle end,
    tiktok_handle = case when social_handle is not null and trim(social_handle) <> '' then social_handle else tiktok_handle end,
    threads_handle = case when social_handle is not null and trim(social_handle) <> '' then social_handle else threads_handle end;
