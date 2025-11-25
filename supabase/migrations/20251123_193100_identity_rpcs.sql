create or replace function add_xp(p_user_id uuid, p_amount bigint, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  lvl integer;
  xp bigint;
  total bigint;
  next bigint;
begin
  insert into user_levels(user_id, level, xp, total_xp, next_level_xp)
    values (p_user_id, 1, 0, 0, 100)
  on conflict(user_id) do nothing;
  select level, xp, total_xp, next_level_xp into lvl, xp, total, next from user_levels where user_id = p_user_id;
  xp := xp + p_amount;
  total := total + p_amount;
  while xp >= next loop
    xp := xp - next;
    lvl := lvl + 1;
    next := next + 100;
  end loop;
  update user_levels set level = lvl, xp = xp, total_xp = total, next_level_xp = next, updated_at = now() where user_id = p_user_id;
  if p_reason is not null then
    insert into identity_reward_logs(user_id, type, amount, data) values (p_user_id, p_reason, p_amount, '{}');
  end if;
  return jsonb_build_object('success', true, 'level', lvl, 'xp', xp, 'total', total, 'next', next);
end;
$$;

create or replace function record_dna_event(p_user_id uuid, p_event_type text, p_data jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  insert into troll_dna_events(user_id, event_type, data) values (p_user_id, p_event_type, coalesce(p_data,'{}'));
  return jsonb_build_object('success', true);
end;
$$;

create or replace function update_dna_profile(p_user_id uuid, p_primary text default null, p_traits jsonb default null, p_scores jsonb default null, p_aura text default null, p_evolution numeric default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare existing boolean;
begin
  select exists(select 1 from troll_dna_profiles where user_id = p_user_id) into existing;
  if not existing then
    insert into troll_dna_profiles(user_id) values (p_user_id);
  end if;
  update troll_dna_profiles set
    primary_dna = coalesce(p_primary, primary_dna),
    traits = coalesce(p_traits, traits),
    personality_scores = coalesce(p_scores, personality_scores),
    aura_style = coalesce(p_aura, aura_style),
    evolution_score = coalesce(p_evolution, evolution_score),
    updated_at = now()
  where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function log_reward_event(p_user_id uuid, p_type text, p_amount numeric, p_data jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  insert into identity_reward_logs(user_id, type, amount, data) values (p_user_id, p_type, p_amount, coalesce(p_data,'{}'));
  return jsonb_build_object('success', true);
end;
$$;

create or replace function process_gift(p_sender uuid, p_recipient uuid, p_coins bigint, p_type text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform record_dna_event(p_sender, case when p_type = 'chaos' then 'SENT_CHAOS_GIFT' else 'HELPED_SMALL_STREAMER' end, jsonb_build_object('coins', p_coins));
  perform add_xp(p_sender, greatest(1, p_coins/100), 'gift_sent');
  return jsonb_build_object('success', true);
end;
$$;

create or replace function start_stream_event(p_user_id uuid, p_minutes integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform record_dna_event(p_user_id, 'STREAM_EVENT', jsonb_build_object('minutes', p_minutes));
  perform add_xp(p_user_id, greatest(1, p_minutes), 'stream_event');
  return jsonb_build_object('success', true);
end;
$$;

create or replace function detect_wheel_bankruptcy(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform record_dna_event(p_user_id, 'WHEEL_BANKRUPT', '{}');
  perform add_xp(p_user_id, 5, 'wheel_event');
  return jsonb_build_object('success', true);
end;
$$;
