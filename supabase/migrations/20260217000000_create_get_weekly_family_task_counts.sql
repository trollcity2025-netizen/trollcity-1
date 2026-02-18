create or replace function get_weekly_family_task_counts()
returns table ( 
    family_id uuid,
    family_name text,
    task_count bigint,
    member_count bigint,
    earnings bigint,
    live_count bigint
)
as $$
begin
    return query
    select
        tf.id as family_id,
        tf.name as family_name,
        count(ft.id) as task_count,
        (select count(*) from family_members where family_id = tf.id) as member_count,
        (select sum(reward_family_coins) from family_tasks where family_id = tf.id and status = 'completed' and updated_at > now() - interval '7 days') as earnings,
        (select count(*) from pod_rooms where host_id in (select user_id from family_members where family_id = tf.id) and is_live = true) as live_count
    from
        troll_families tf
    left join
        family_tasks ft on tf.id = ft.family_id
    where
        ft.status = 'completed' and ft.updated_at > now() - interval '7 days'
    group by
        tf.id
    order by
        task_count desc;
end;
$$ language plpgsql;