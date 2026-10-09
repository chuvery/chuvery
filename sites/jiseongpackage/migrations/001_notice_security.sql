-- Jiseong Package isolated Supabase project only. Never apply to REVIEW MEET/YEOUL.LAB/CAMUS.
create extension if not exists pgcrypto;
create table if not exists public.jp_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.jp_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 20000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jp_notices_public_idx on public.jp_notices(is_published,created_at desc);
alter table public.jp_admins enable row level security;
alter table public.jp_notices enable row level security;
revoke all on public.jp_admins from anon, authenticated;
grant select on public.jp_admins to authenticated;
grant select on public.jp_notices to anon, authenticated;
grant insert,update,delete on public.jp_notices to authenticated;
create policy "admin self read" on public.jp_admins for select to authenticated using (user_id=auth.uid());
create policy "published notices read" on public.jp_notices for select to anon,authenticated using (is_published or exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
create policy "admin create notices" on public.jp_notices for insert to authenticated with check (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
create policy "admin modify notices" on public.jp_notices for update to authenticated using (exists (select 1 from public.jp_admins a where a.user_id=auth.uid())) with check (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
create policy "admin remove notices" on public.jp_notices for delete to authenticated using (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
-- Manually invite admin in isolated Supabase Auth (no public signup), then:
-- insert into public.jp_admins(user_id) values ('ADMIN_AUTH_USER_UUID');

create table if not exists public.jp_popups (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 120),
 image_url text not null check (char_length(image_url) between 1 and 500),
 notice_id uuid references public.jp_notices(id) on delete set null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 is_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 constraint jp_popup_time_range check (ends_at > starts_at),
 constraint jp_popup_safe_image check (image_url ~ '^/assets/[a-zA-Z0-9/_\\.-]+\\.(png|jpg|jpeg|webp)$')
);
alter table public.jp_popups enable row level security;
grant select on public.jp_popups to anon, authenticated;
grant insert,update,delete on public.jp_popups to authenticated;
create policy "visible active popups" on public.jp_popups for select to anon,authenticated using (
(is_enabled and starts_at <= now() and ends_at > now()) or exists (select 1 from public.jp_admins a where a.user_id=auth.uid())
);
create policy "admin create popups" on public.jp_popups for insert to authenticated with check (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
create policy "admin update popups" on public.jp_popups for update to authenticated using (exists (select 1 from public.jp_admins a where a.user_id=auth.uid())) with check (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
create policy "admin delete popups" on public.jp_popups for delete to authenticated using (exists (select 1 from public.jp_admins a where a.user_id=auth.uid()));
