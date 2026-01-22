-- Secure check_daily_login function
-- Remove p_user_id argument and use auth.uid() instead

DROP FUNCTION IF EXISTS public.check_daily_login(uuid);

CREATE OR REPLACE FUNCTION public.check_daily_login()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  today date := current_date;
  row_exists boolean;
  already_claimed boolean := false;
  new_streak int := 1;
  reward int := 250; -- daily reward amount
begin
  if v_user_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  -- Ensure row exists
  select exists(select 1 from daily_logins where user_id = v_user_id)
  into row_exists;

  if not row_exists then
    insert into daily_logins (user_id, last_login_date, streak)
    values (v_user_id, today, 1);

  else
    -- If last login was today, already claimed        
    if (select last_login_date from daily_logins where user_id = v_user_id) = today then
      already_claimed := true;
    else
      -- Update streak
      if (select last_login_date from daily_logins where user_id = v_user_id) = today - interval '1 day' then 
        new_streak := (select streak from daily_logins where user_id = v_user_id) + 1;
      else
        new_streak := 1;
      end if;

      update daily_logins
      set last_login_date = today,
          streak = new_streak,
          updated_at = now()
      where user_id = v_user_id;
    end if;
  end if;

  -- If not already claimed, reward coins
  if not already_claimed then
    update user_profiles
    set troll_coins = coalesce(troll_coins,0) + reward 
    where id = v_user_id; -- Use id as it's the primary key usually matching auth.uid()
  end if;

  return json_build_object(
    'claimed', not already_claimed,
    'reward', case when already_claimed then 0 else reward end,
    'streak', (select streak from daily_logins where user_id = v_user_id)
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.check_daily_login() TO authenticated;
