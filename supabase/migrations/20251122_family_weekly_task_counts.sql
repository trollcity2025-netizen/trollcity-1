-- Weekly family task counts for Troll Family City game
create or replace function public.get_weekly_family_task_counts()
returns table (
  family_id uuid,
  family_name text,
  total_points integer,
  task_count integer
)
language sql
as $$
  select
    f.id as family_id,
    coalesce(f.name, 'Unknown Family') as family_name,
    coalesce(sum(case when ft.status = 'completed' then ft.points else 0 end), 0)::int as total_points,
    count(*) filter (
      where ft.status = 'completed'
        and ft.completed_at >= date_trunc('week', now())
    )::int as task_count
  from families f
  left join family_tasks ft
    on ft.family_id = f.id
  where coalesce(f.is_active, true) = true
  group by f.id, f.name
  order by task_count desc, total_points desc;
$$;
