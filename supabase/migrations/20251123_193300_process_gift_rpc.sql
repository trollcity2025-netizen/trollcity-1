create or replace function process_gift(
  p_sender_id uuid,
  p_streamer_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_coins_spent integer,
  p_gift_type text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare evt text;
begin
  insert into gifts(stream_id, sender_id, receiver_id, coins_spent, gift_type, message)
    values (p_stream_id, p_sender_id, p_streamer_id, p_coins_spent, 'gift', p_gift_name);

  if p_gift_id in ('diamond','car') then
    evt := 'EPIC_GIFT_CHAOS';
  elsif p_gift_id in ('crown') then
    evt := 'LEGACY_EVENT';
  else
    evt := case when p_gift_type = 'paid' then 'SENT_CHAOS_GIFT' else 'HELPED_SMALL_STREAMER' end;
  end if;

  perform record_dna_event(p_sender_id, evt, jsonb_build_object('gift_id', p_gift_id, 'coins', p_coins_spent));
  perform add_xp(p_sender_id, greatest(1, p_coins_spent/50), 'gift_sent');
  return jsonb_build_object('success', true);
end;
$$;
