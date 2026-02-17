create or replace function public.delete_troll_wall_post(post_id uuid)
returns void as $$
declare
  is_post_owner boolean;
  is_staff boolean;
  user_role text;
  user_troll_role text;
begin
  -- Check if the user is the owner of the post
  select user_id = auth.uid() into is_post_owner from public.troll_wall_posts where id = post_id;

  -- Get the user's roles
  select role, troll_role into user_role, user_troll_role from public.user_profiles where id = auth.uid();

  -- Check if the user has a staff role
  is_staff := user_role in ('admin', 'secretary') or user_troll_role in ('lead_troll_officer', 'troll_officer');

  -- If the user is not the owner and not staff, they can't delete
  if not is_post_owner and not is_staff then
    raise exception 'You do not have permission to delete this post.';
  end if;

  -- Delete the post
  delete from public.troll_wall_posts where id = post_id;
end;
$$ language plpgsql security definer;