create or replace function public.share_post_to_profile(original_post_id uuid)
returns void as $$
begin
  insert into public.troll_posts(user_id, content, post_type, original_post_id)
  select auth.uid(), content, 'shared_post', id
  from public.troll_wall_posts
  where id = original_post_id;
end;
$$ language plpgsql security definer;