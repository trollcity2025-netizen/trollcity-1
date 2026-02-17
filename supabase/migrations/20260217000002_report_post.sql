create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.troll_wall_posts(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.post_reports enable row level security;

create policy "Users can report posts" on public.post_reports for insert with check (reporter_id = auth.uid());
create policy "Admins can see all reports" on public.post_reports for select using (is_admin(auth.uid()));

create or replace function public.report_post(post_id uuid, reason text)
returns void as $$
begin
  insert into public.post_reports(post_id, reporter_id, reason)
  values(post_id, auth.uid(), reason);
end;
$$ language plpgsql security definer;