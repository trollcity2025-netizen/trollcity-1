create table if not exists troll_ai_avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dna_key text not null,
  personality_type text not null,
  behavior_rules jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into troll_ai_avatars(name, dna_key, personality_type, behavior_rules)
values
('Chaos Troll','CHAOS_DNA','chaotic', jsonb_build_object('events', array['WHEEL_BANKRUPT','SENT_CHAOS_GIFT','HIGH_RISK_SPIN']::text[])),
('Mad Troll','MAD_TROLL_DNA','aggressive', jsonb_build_object('events', array['WAR_BEGIN','HIGH_RISK_SPIN']::text[])),
('Ghost Troll','GHOST_DNA','mysterious', jsonb_build_object('events', array['SILENT_WATCHER','STREAM_START']::text[])),
('Guardian Troll','GUARDIAN_DNA','protective', jsonb_build_object('events', array['STREAM_EVENT','LEGACY_EVENT']::text[])),
('Royal Troll','LEGACY_DNA','royal', jsonb_build_object('events', array['LEGACY_EVENT','SENT_CHAOS_GIFT']::text[])),
('Battle Troll','WARRIOR_DNA','warrior', jsonb_build_object('events', array['WAR_BEGIN','STREAM_EVENT']::text[]))
on conflict do nothing;

