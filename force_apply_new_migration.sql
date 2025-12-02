-- Force apply new migration with IF NOT EXISTS checks
-- This is safe to run multiple times

-- Officer Training System
CREATE TABLE IF NOT EXISTS training_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL,
  description TEXT NOT NULL,
  chat_messages JSONB NOT NULL,
  correct_action TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 10,
  difficulty_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officer_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time_seconds INTEGER,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_officer ON officer_training_sessions(officer_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_scenario ON officer_training_sessions(scenario_id);

-- Observer Bot System
CREATE TABLE IF NOT EXISTS moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES moderation_events(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  verdict TEXT NOT NULL,
  policy_tags TEXT[],
  feedback TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_officer ON moderation_events(officer_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_stream ON moderation_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_observer_ratings_event ON observer_ratings(event_id);

-- Add officer_reputation_score to user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_reputation_score') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_reputation_score INTEGER DEFAULT 100 CHECK (officer_reputation_score >= 0 AND officer_reputation_score <= 200);
  END IF;
END $$;

-- Ghost Mode System
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_ghost_mode') THEN
    ALTER TABLE user_profiles ADD COLUMN is_ghost_mode BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Shadow Ban System
CREATE TABLE IF NOT EXISTS shadow_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_bans_target ON shadow_bans(target_user_id);
CREATE INDEX IF NOT EXISTS idx_shadow_bans_stream ON shadow_bans(stream_id);
CREATE INDEX IF NOT EXISTS idx_shadow_bans_active ON shadow_bans(is_active) WHERE is_active = TRUE;

-- Ghost Mode Activity Tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_live_assignments' AND column_name = 'ghost_mode_active') THEN
    ALTER TABLE officer_live_assignments ADD COLUMN ghost_mode_active BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ghost_presence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  minutes_in_ghost_mode INTEGER DEFAULT 0,
  events_moderated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officer_mission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mission_type TEXT NOT NULL,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  coins_awarded INTEGER DEFAULT 0,
  reputation_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Punishment System
CREATE TABLE IF NOT EXISTS punishment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coins_deducted BIGINT NOT NULL,
  reason TEXT NOT NULL,
  appeal_id UUID,
  verdict TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punishment_transactions_user ON punishment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_punishment_transactions_created ON punishment_transactions(created_at DESC);

-- RPC Functions
CREATE OR REPLACE FUNCTION deduct_user_coins(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_appeal_id UUID,
  p_verdict TEXT
)
RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_deducted INTEGER;
BEGIN
  SELECT free_coin_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  v_deducted := LEAST(v_current_balance, p_amount);

  UPDATE user_profiles
  SET free_coin_balance = GREATEST(free_coin_balance - p_amount, 0)
  WHERE id = p_user_id;

  INSERT INTO punishment_transactions (user_id, coins_deducted, reason, appeal_id, verdict)
  VALUES (p_user_id, v_deducted, p_reason, p_appeal_id, p_verdict);

  RETURN json_build_object(
    'success', true,
    'deducted', v_deducted,
    'remaining', GREATEST(v_current_balance - p_amount, 0)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to detect ghost inactivity
CREATE OR REPLACE FUNCTION detect_ghost_inactivity()
RETURNS TABLE (officer_id UUID, session_id UUID) AS $$
SELECT
  ola.officer_id,
  ows.id AS session_id
FROM officer_live_assignments ola
JOIN officer_work_sessions ows ON ola.officer_id = ows.officer_id AND ows.clock_out IS NULL
WHERE ola.ghost_mode_active = TRUE
AND ola.last_activity < NOW() - INTERVAL '20 minutes'
AND ola.status = 'active';
$$ LANGUAGE sql;

-- Seed training scenarios (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM training_scenarios LIMIT 1) THEN
    INSERT INTO training_scenarios (scenario_type, description, chat_messages, correct_action, points_awarded, difficulty_level)
    VALUES
      ('harassment', 'User repeatedly insults another viewer', 
       '[{"username": "TrollUser123", "message": "You are so stupid", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "TrollUser123", "message": "Get out of here loser", "timestamp": "2024-01-01T10:00:15Z"}, {"username": "TrollUser123", "message": "Nobody wants you here", "timestamp": "2024-01-01T10:00:30Z"}]',
       'warn', 10, 1),
      ('spam', 'User sends same message 10 times in a row',
       '[{"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:05Z"}, {"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:10Z"}]',
       'mute', 10, 1),
      ('scam', 'User trying to sell fake coins',
       '[{"username": "CoinSeller", "message": "DM me for cheap coins! Only $5 for 10k!", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "CoinSeller", "message": "Trust me, I have proof", "timestamp": "2024-01-01T10:00:10Z"}]',
       'ban', 20, 2),
      ('self_harm', 'User mentions self-harm',
       '[{"username": "UserInCrisis", "message": "I want to hurt myself", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "UserInCrisis", "message": "Nobody cares about me", "timestamp": "2024-01-01T10:00:15Z"}]',
       'escalate', 30, 3);
  END IF;
END $$;

- -   U s e r   V e r i f i c a t i o n   S y s t e m  
 - -   A d d   v e r i f i c a t i o n   c o l u m n s   t o   u s e r _ p r o f i l e s  
 D O   $ $    
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' i s _ v e r i f i e d ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   i s _ v e r i f i e d   B O O L E A N   D E F A U L T   F A L S E ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' v e r i f i c a t i o n _ d a t e ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   v e r i f i c a t i o n _ d a t e   T I M E S T A M P T Z ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' v e r i f i c a t i o n _ p a i d _ a m o u n t ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   v e r i f i c a t i o n _ p a i d _ a m o u n t   N U M E R I C ( 1 0 ,   2 ) ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' v e r i f i c a t i o n _ p a y m e n t _ m e t h o d ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   v e r i f i c a t i o n _ p a y m e n t _ m e t h o d   T E X T ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   C r e a t e   v e r i f i c a t i o n _ t r a n s a c t i o n s   t a b l e   f o r   a u d i t   t r a i l  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   v e r i f i c a t i o n _ t r a n s a c t i o n s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     u s e r _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   u s e r _ p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     p a y m e n t _ m e t h o d   T E X T   N O T   N U L L ,   - -   ' p a y p a l '   o r   ' c o i n s '  
     a m o u n t   N U M E R I C ( 1 0 ,   2 )   N O T   N U L L ,  
     p a y m e n t _ r e f e r e n c e   T E X T ,   - -   P a y P a l   t r a n s a c t i o n   I D   o r   c o i n   t r a n s a c t i o n   I D  
     s t a t u s   T E X T   D E F A U L T   ' c o m p l e t e d ' ,  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( )  
 ) ;  
  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e r i f i c a t i o n _ t r a n s a c t i o n s _ u s e r   O N   v e r i f i c a t i o n _ t r a n s a c t i o n s ( u s e r _ i d ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e r i f i c a t i o n _ t r a n s a c t i o n s _ c r e a t e d   O N   v e r i f i c a t i o n _ t r a n s a c t i o n s ( c r e a t e d _ a t   D E S C ) ;  
  
 - -   R P C   f u n c t i o n   t o   v e r i f y   u s e r  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   v e r i f y _ u s e r (  
     p _ u s e r _ i d   U U I D ,  
     p _ p a y m e n t _ m e t h o d   T E X T ,  
     p _ a m o u n t   N U M E R I C ,  
     p _ p a y m e n t _ r e f e r e n c e   T E X T   D E F A U L T   N U L L  
 )  
 R E T U R N S   J S O N   A S   $ $  
 D E C L A R E  
     v _ c u r r e n t _ s t a t u s   B O O L E A N ;  
 B E G I N  
     - -   G e t   c u r r e n t   v e r i f i c a t i o n   s t a t u s  
     S E L E C T   i s _ v e r i f i e d   I N T O   v _ c u r r e n t _ s t a t u s  
     F R O M   u s e r _ p r o f i l e s  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     - -   I f   a l r e a d y   v e r i f i e d ,   r e t u r n   e a r l y  
     I F   v _ c u r r e n t _ s t a t u s   =   T R U E   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t ( ' s u c c e s s ' ,   f a l s e ,   ' e r r o r ' ,   ' U s e r   a l r e a d y   v e r i f i e d ' ) ;  
     E N D   I F ;  
  
     - -   U p d a t e   u s e r   p r o f i l e  
     U P D A T E   u s e r _ p r o f i l e s  
     S E T    
         i s _ v e r i f i e d   =   T R U E ,  
         v e r i f i c a t i o n _ d a t e   =   N O W ( ) ,  
         v e r i f i c a t i o n _ p a i d _ a m o u n t   =   p _ a m o u n t ,  
         v e r i f i c a t i o n _ p a y m e n t _ m e t h o d   =   p _ p a y m e n t _ m e t h o d ,  
         u p d a t e d _ a t   =   N O W ( )  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     - -   L o g   t r a n s a c t i o n  
     I N S E R T   I N T O   v e r i f i c a t i o n _ t r a n s a c t i o n s   ( u s e r _ i d ,   p a y m e n t _ m e t h o d ,   a m o u n t ,   p a y m e n t _ r e f e r e n c e ,   s t a t u s )  
     V A L U E S   ( p _ u s e r _ i d ,   p _ p a y m e n t _ m e t h o d ,   p _ a m o u n t ,   p _ p a y m e n t _ r e f e r e n c e ,   ' c o m p l e t e d ' ) ;  
  
     R E T U R N   j s o n _ b u i l d _ o b j e c t ( ' s u c c e s s ' ,   t r u e ,   ' v e r i f i e d ' ,   T R U E ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   R P C   f u n c t i o n   t o   r e m o v e   v e r i f i c a t i o n   ( a d m i n   o n l y )  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e m o v e _ v e r i f i c a t i o n ( p _ u s e r _ i d   U U I D )  
 R E T U R N S   J S O N   A S   $ $  
 B E G I N  
     U P D A T E   u s e r _ p r o f i l e s  
     S E T    
         i s _ v e r i f i e d   =   F A L S E ,  
         v e r i f i c a t i o n _ d a t e   =   N U L L ,  
         v e r i f i c a t i o n _ p a i d _ a m o u n t   =   N U L L ,  
         v e r i f i c a t i o n _ p a y m e n t _ m e t h o d   =   N U L L ,  
         u p d a t e d _ a t   =   N O W ( )  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     R E T U R N   j s o n _ b u i l d _ o b j e c t ( ' s u c c e s s ' ,   t r u e ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   A u t o - r e m o v e   v e r i f i c a t i o n   o n   p e r m a n e n t   b a n  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   a u t o _ r e m o v e _ v e r i f i c a t i o n _ o n _ b a n ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
     I F   N E W . i s _ b a n n e d   =   T R U E   A N D   N E W . b a n _ e x p i r e s _ a t   I S   N U L L   T H E N  
         - -   P e r m a n e n t   b a n   -   r e m o v e   v e r i f i c a t i o n  
         U P D A T E   u s e r _ p r o f i l e s  
         S E T    
             i s _ v e r i f i e d   =   F A L S E ,  
             v e r i f i c a t i o n _ d a t e   =   N U L L ,  
             u p d a t e d _ a t   =   N O W ( )  
         W H E R E   i d   =   N E W . i d ;  
     E N D   I F ;  
     R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   C r e a t e   t r i g g e r   i f   n o t   e x i s t s  
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ a u t o _ r e m o v e _ v e r i f i c a t i o n   O N   u s e r _ p r o f i l e s ;  
 C R E A T E   T R I G G E R   t r i g g e r _ a u t o _ r e m o v e _ v e r i f i c a t i o n  
     A F T E R   U P D A T E   O F   i s _ b a n n e d ,   b a n _ e x p i r e s _ a t   O N   u s e r _ p r o f i l e s  
     F O R   E A C H   R O W  
     W H E N   ( N E W . i s _ b a n n e d   =   T R U E   A N D   N E W . b a n _ e x p i r e s _ a t   I S   N U L L )  
     E X E C U T E   F U N C T I O N   a u t o _ r e m o v e _ v e r i f i c a t i o n _ o n _ b a n ( ) ;  
  
 - -   A I - P o w e r e d   V e r i f i c a t i o n   S y s t e m  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   v e r i f i c a t i o n _ r e q u e s t s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     u s e r _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   u s e r _ p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     i d _ p h o t o _ u r l   T E X T   N O T   N U L L ,  
     s e l f i e _ u r l   T E X T   N O T   N U L L ,  
     a i _ m a t c h _ s c o r e   N U M E R I C ( 5 ,   2 ) ,   - -   0 - 1 0 0  
     a i _ b e h a v i o r _ s c o r e   N U M E R I C ( 5 ,   2 ) ,   - -   0 - 1 0 0  
     s t a t u s   T E X T   C H E C K   ( s t a t u s   I N   ( ' p e n d i n g ' ,   ' a p p r o v e d ' ,   ' d e n i e d ' ,   ' i n _ r e v i e w ' ) )   D E F A U L T   ' p e n d i n g ' ,  
     i n f l u e n c e r _ t i e r   B O O L E A N   D E F A U L T   F A L S E ,  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     r e v i e w e d _ a t   T I M E S T A M P T Z ,  
     a d m i n _ r e v i e w e r   U U I D   R E F E R E N C E S   u s e r _ p r o f i l e s ( i d )   O N   D E L E T E   S E T   N U L L ,  
     a d m i n _ n o t e   T E X T  
 ) ;  
  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e r i f i c a t i o n _ r e q u e s t s _ u s e r   O N   v e r i f i c a t i o n _ r e q u e s t s ( u s e r _ i d ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e r i f i c a t i o n _ r e q u e s t s _ s t a t u s   O N   v e r i f i c a t i o n _ r e q u e s t s ( s t a t u s ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ v e r i f i c a t i o n _ r e q u e s t s _ c r e a t e d   O N   v e r i f i c a t i o n _ r e q u e s t s ( c r e a t e d _ a t   D E S C ) ;  
  
 - -   A d d   i n f l u e n c e r   a n d   p r o f i l e   c u s t o m i z a t i o n   c o l u m n s  
 D O   $ $    
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' i n f l u e n c e r _ t i e r ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   i n f l u e n c e r _ t i e r   T E X T   D E F A U L T   N U L L   C H E C K   ( i n f l u e n c e r _ t i e r   I N   ( ' b a s i c ' ,   ' g o l d ' ,   ' p l a t i n u m ' ) ) ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' p r o f i l e _ b a n n e r _ u r l ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   p r o f i l e _ b a n n e r _ u r l   T E X T   D E F A U L T   N U L L ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' p r o f i l e _ t h e m e ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   p r o f i l e _ t h e m e   T E X T   D E F A U L T   N U L L ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   F u n c t i o n   t o   c h e c k   i n f l u e n c e r   e l i g i b i l i t y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c h e c k _ i n f l u e n c e r _ e l i g i b i l i t y ( p _ u s e r _ i d   U U I D )  
 R E T U R N S   J S O N   A S   $ $  
 D E C L A R E  
     v _ f o l l o w e r s _ c o u n t   I N T E G E R ;  
     v _ c o i n s _ r e c e i v e d   I N T E G E R ;  
     v _ i s _ v e r i f i e d   B O O L E A N ;  
 B E G I N  
     S E L E C T    
         i s _ v e r i f i e d ,  
         ( S E L E C T   C O U N T ( * )   F R O M   f o l l o w s   W H E R E   f o l l o w i n g _ i d   =   p _ u s e r _ i d )   a s   f o l l o w e r s ,  
         ( S E L E C T   C O A L E S C E ( S U M ( c o i n s ) ,   0 )   F R O M   c o i n _ t r a n s a c t i o n s   W H E R E   u s e r _ i d   =   p _ u s e r _ i d   A N D   t y p e   =   ' g i f t _ r e c e i v e d ' )  
     I N T O   v _ i s _ v e r i f i e d ,   v _ f o l l o w e r s _ c o u n t ,   v _ c o i n s _ r e c e i v e d  
     F R O M   u s e r _ p r o f i l e s  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     I F   v _ i s _ v e r i f i e d   =   T R U E   A N D   v _ f o l l o w e r s _ c o u n t   > =   2 0 0   A N D   v _ c o i n s _ r e c e i v e d   > =   5 0 0 0   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t (  
             ' e l i g i b l e ' ,   t r u e ,  
             ' f o l l o w e r s ' ,   v _ f o l l o w e r s _ c o u n t ,  
             ' c o i n s _ r e c e i v e d ' ,   v _ c o i n s _ r e c e i v e d  
         ) ;  
     E N D   I F ;  
  
     R E T U R N   j s o n _ b u i l d _ o b j e c t (  
         ' e l i g i b l e ' ,   f a l s e ,  
         ' f o l l o w e r s ' ,   v _ f o l l o w e r s _ c o u n t ,  
         ' c o i n s _ r e c e i v e d ' ,   v _ c o i n s _ r e c e i v e d ,  
         ' n e e d s _ v e r i f i e d ' ,   N O T   v _ i s _ v e r i f i e d ,  
         ' n e e d s _ f o l l o w e r s ' ,   v _ f o l l o w e r s _ c o u n t   <   2 0 0 ,  
         ' n e e d s _ c o i n s ' ,   v _ c o i n s _ r e c e i v e d   <   5 0 0 0  
     ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   F u n c t i o n   t o   a u t o - u p g r a d e   t o   i n f l u e n c e r   t i e r  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   a u t o _ u p g r a d e _ i n f l u e n c e r _ t i e r ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
     I F   N E W . i s _ v e r i f i e d   =   T R U E   A N D   ( O L D . i s _ v e r i f i e d   I S   N U L L   O R   O L D . i s _ v e r i f i e d   =   F A L S E )   T H E N  
         - -   C h e c k   i f   u s e r   q u a l i f i e s   f o r   i n f l u e n c e r   t i e r  
         P E R F O R M   c h e c k _ i n f l u e n c e r _ e l i g i b i l i t y ( N E W . i d ) ;  
         - -   T h i s   c a n   b e   c a l l e d   f r o m   a p p l i c a t i o n   l o g i c  
     E N D   I F ;  
     R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ a u t o _ u p g r a d e _ i n f l u e n c e r   O N   u s e r _ p r o f i l e s ;  
 C R E A T E   T R I G G E R   t r i g g e r _ a u t o _ u p g r a d e _ i n f l u e n c e r  
     A F T E R   U P D A T E   O F   i s _ v e r i f i e d   O N   u s e r _ p r o f i l e s  
     F O R   E A C H   R O W  
     W H E N   ( N E W . i s _ v e r i f i e d   =   T R U E )  
     E X E C U T E   F U N C T I O N   a u t o _ u p g r a d e _ i n f l u e n c e r _ t i e r ( ) ;  
  
 - -   O f f i c e r   t i e r   b a d g e s   u p d a t e  
 D O   $ $  
 B E G I N  
     - -   U p d a t e   o f f i c e r _ l e v e l   d e s c r i p t i o n s   i f   n e e d e d  
     - -   T h i s   i s   h a n d l e d   i n   a p p l i c a t i o n   l o g i c ,   b u t   w e   e n s u r e   t h e   c o l u m n   e x i s t s  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' o f f i c e r _ l e v e l ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   o f f i c e r _ l e v e l   I N T E G E R   D E F A U L T   1 ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   O f f i c e r   T i e r   S y s t e m   w i t h   B a d g e s  
 - -   U p d a t e   o f f i c e r _ l e v e l   d e s c r i p t i o n s   a n d   e n s u r e   p r o p e r   s t r u c t u r e  
  
 - -   E n s u r e   o f f i c e r _ l e v e l   e x i s t s  
 D O   $ $    
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' o f f i c e r _ l e v e l ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   o f f i c e r _ l e v e l   I N T E G E R   D E F A U L T   1   C H E C K   ( o f f i c e r _ l e v e l   > =   1   A N D   o f f i c e r _ l e v e l   < =   3 ) ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   A d d   o f f i c e r _ t i e r _ b a d g e   c o l u m n   f o r   v i s u a l   b a d g e  
 D O   $ $    
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' o f f i c e r _ t i e r _ b a d g e ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   o f f i c e r _ t i e r _ b a d g e   T E X T   D E F A U L T   ' b l u e '   C H E C K   ( o f f i c e r _ t i e r _ b a d g e   I N   ( ' b l u e ' ,   ' o r a n g e ' ,   ' r e d ' ) ) ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   F u n c t i o n   t o   u p d a t e   o f f i c e r   t i e r   b a d g e   b a s e d   o n   l e v e l  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   u p d a t e _ o f f i c e r _ t i e r _ b a d g e ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
     I F   N E W . o f f i c e r _ l e v e l   I S   N O T   N U L L   T H E N  
         N E W . o f f i c e r _ t i e r _ b a d g e   : =   C A S E  
             W H E N   N E W . o f f i c e r _ l e v e l   =   1   T H E N   ' b l u e '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   2   T H E N   ' o r a n g e '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   3   T H E N   ' r e d '  
             E L S E   ' b l u e '  
         E N D ;  
     E N D   I F ;  
     R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ u p d a t e _ o f f i c e r _ t i e r _ b a d g e   O N   u s e r _ p r o f i l e s ;  
 C R E A T E   T R I G G E R   t r i g g e r _ u p d a t e _ o f f i c e r _ t i e r _ b a d g e  
     B E F O R E   I N S E R T   O R   U P D A T E   O F   o f f i c e r _ l e v e l   O N   u s e r _ p r o f i l e s  
     F O R   E A C H   R O W  
     W H E N   ( N E W . i s _ t r o l l _ o f f i c e r   =   T R U E   O R   N E W . r o l e   =   ' t r o l l _ o f f i c e r ' )  
     E X E C U T E   F U N C T I O N   u p d a t e _ o f f i c e r _ t i e r _ b a d g e ( ) ;  
  
 - -   U p d a t e   e x i s t i n g   o f f i c e r s   t o   h a v e   c o r r e c t   b a d g e  
 U P D A T E   u s e r _ p r o f i l e s  
 S E T   o f f i c e r _ t i e r _ b a d g e   =   C A S E  
     W H E N   o f f i c e r _ l e v e l   =   1   T H E N   ' b l u e '  
     W H E N   o f f i c e r _ l e v e l   =   2   T H E N   ' o r a n g e '  
     W H E N   o f f i c e r _ l e v e l   =   3   T H E N   ' r e d '  
     E L S E   ' b l u e '  
 E N D  
 W H E R E   ( i s _ t r o l l _ o f f i c e r   =   T R U E   O R   r o l e   =   ' t r o l l _ o f f i c e r ' )  
 A N D   o f f i c e r _ t i e r _ b a d g e   I S   N U L L ;  
  
 - -   O f f i c e r   W o r k   C r e d i t   ( O W C )   P a y   S y s t e m  
 - -   N e w   p a y   s t r u c t u r e   w i t h   O W C   a n d   c o n v e r s i o n   r a t e s  
  
 - -   A d d   O W C - r e l a t e d   c o l u m n s   t o   u s e r _ p r o f i l e s  
 D O   $ $    
 B E G I N  
     - -   A d d   o f f i c e r _ l e v e l   i f   i t   d o e s n ' t   e x i s t   ( s h o u l d   s u p p o r t   l e v e l s   1 - 5   n o w )  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' o f f i c e r _ l e v e l ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   o f f i c e r _ l e v e l   I N T E G E R   D E F A U L T   1   C H E C K   ( o f f i c e r _ l e v e l   > =   1   A N D   o f f i c e r _ l e v e l   < =   5 ) ;  
     E L S E  
         - -   U p d a t e   c h e c k   c o n s t r a i n t   t o   a l l o w   l e v e l   5  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   D R O P   C O N S T R A I N T   I F   E X I S T S   u s e r _ p r o f i l e s _ o f f i c e r _ l e v e l _ c h e c k ;  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O N S T R A I N T   u s e r _ p r o f i l e s _ o f f i c e r _ l e v e l _ c h e c k   C H E C K   ( o f f i c e r _ l e v e l   > =   1   A N D   o f f i c e r _ l e v e l   < =   5 ) ;  
     E N D   I F ;  
  
     - -   A d d   O W C   b a l a n c e  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' o w c _ b a l a n c e ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   o w c _ b a l a n c e   B I G I N T   D E F A U L T   0 ;  
     E N D   I F ;  
  
     - -   A d d   t o t a l   O W C   e a r n e d   ( l i f e t i m e )  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' u s e r _ p r o f i l e s '   A N D   c o l u m n _ n a m e   =   ' t o t a l _ o w c _ e a r n e d ' )   T H E N  
         A L T E R   T A B L E   u s e r _ p r o f i l e s   A D D   C O L U M N   t o t a l _ o w c _ e a r n e d   B I G I N T   D E F A U L T   0 ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   C r e a t e   O W C   t r a n s a c t i o n   l o g   t a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   o w c _ t r a n s a c t i o n s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     u s e r _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   u s e r _ p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     a m o u n t   B I G I N T   N O T   N U L L ,  
     t r a n s a c t i o n _ t y p e   T E X T   N O T   N U L L   C H E C K   ( t r a n s a c t i o n _ t y p e   I N   ( ' e a r n e d ' ,   ' c o n v e r t e d ' ,   ' b o n u s ' ,   ' d e d u c t e d ' ) ) ,  
     s o u r c e   T E X T ,   - -   ' s h i f t ' ,   ' c o n v e r s i o n ' ,   ' b o n u s ' ,   e t c .  
     s e s s i o n _ i d   U U I D   R E F E R E N C E S   o f f i c e r _ w o r k _ s e s s i o n s ( i d )   O N   D E L E T E   S E T   N U L L ,  
     c o n v e r s i o n _ r a t e   N U M E R I C ( 5 ,   4 ) ,   - -   e . g . ,   0 . 0 0 5   f o r   0 . 5 %  
     p a i d _ c o i n s _ r e c e i v e d   B I G I N T ,   - -   I f   c o n v e r t e d ,   h o w   m a n y   p a i d   c o i n s  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( )  
 ) ;  
  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ o w c _ t r a n s a c t i o n s _ u s e r   O N   o w c _ t r a n s a c t i o n s ( u s e r _ i d ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ o w c _ t r a n s a c t i o n s _ c r e a t e d   O N   o w c _ t r a n s a c t i o n s ( c r e a t e d _ a t   D E S C ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ o w c _ t r a n s a c t i o n s _ t y p e   O N   o w c _ t r a n s a c t i o n s ( t r a n s a c t i o n _ t y p e ) ;  
  
 - -   U p d a t e   o f f i c e r _ w o r k _ s e s s i o n s   t o   t r a c k   O W C  
 D O   $ $  
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' o f f i c e r _ w o r k _ s e s s i o n s '   A N D   c o l u m n _ n a m e   =   ' o w c _ e a r n e d ' )   T H E N  
         A L T E R   T A B L E   o f f i c e r _ w o r k _ s e s s i o n s   A D D   C O L U M N   o w c _ e a r n e d   B I G I N T   D E F A U L T   0 ;  
     E N D   I F ;  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' o f f i c e r _ w o r k _ s e s s i o n s '   A N D   c o l u m n _ n a m e   =   ' p a i d _ c o i n s _ c o n v e r t e d ' )   T H E N  
         A L T E R   T A B L E   o f f i c e r _ w o r k _ s e s s i o n s   A D D   C O L U M N   p a i d _ c o i n s _ c o n v e r t e d   B I G I N T   D E F A U L T   0 ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   F u n c t i o n   t o   g e t   O W C   r a t e   p e r   h o u r   b a s e d   o n   o f f i c e r   l e v e l  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   g e t _ o w c _ p e r _ h o u r ( p _ l e v e l   I N T E G E R )  
 R E T U R N S   B I G I N T   A S   $ $  
 B E G I N  
     R E T U R N   C A S E  
         W H E N   p _ l e v e l   =   1   T H E N   1 0 0 0 0 0 0     - -   J u n i o r   O f f i c e r  
         W H E N   p _ l e v e l   =   2   T H E N   1 5 0 0 0 0 0     - -   S e n i o r   O f f i c e r  
         W H E N   p _ l e v e l   =   3   T H E N   1 8 0 0 0 0 0     - -   C o m m a n d e r  
         W H E N   p _ l e v e l   =   4   T H E N   2 2 0 0 0 0 0     - -   E l i t e   C o m m a n d e r  
         W H E N   p _ l e v e l   =   5   T H E N   2 6 0 0 0 0 0     - -   H Q   M a s t e r   O f f i c e r  
         E L S E   1 0 0 0 0 0 0  
     E N D ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   I M M U T A B L E ;  
  
 - -   F u n c t i o n   t o   g e t   c o n v e r s i o n   r a t e   b a s e d   o n   o f f i c e r   l e v e l  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   g e t _ o w c _ c o n v e r s i o n _ r a t e ( p _ l e v e l   I N T E G E R )  
 R E T U R N S   N U M E R I C   A S   $ $  
 B E G I N  
     R E T U R N   C A S E  
         W H E N   p _ l e v e l   =   1   T H E N   0 . 0 0 5     - -   0 . 5 %  
         W H E N   p _ l e v e l   =   2   T H E N   0 . 0 0 7     - -   0 . 7 %  
         W H E N   p _ l e v e l   =   3   T H E N   0 . 0 0 8     - -   0 . 8 %  
         W H E N   p _ l e v e l   =   4   T H E N   0 . 0 0 9     - -   0 . 9 %  
         W H E N   p _ l e v e l   =   5   T H E N   0 . 0 1 1     - -   1 . 1 %  
         E L S E   0 . 0 0 5  
     E N D ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   I M M U T A B L E ;  
  
 - -   F u n c t i o n   t o   c a l c u l a t e   p a i d   c o i n s   f r o m   O W C   ( w i t h   1 0 %   b o n u s )  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c o n v e r t _ o w c _ t o _ p a i d _ c o i n s ( p _ o w c   B I G I N T ,   p _ l e v e l   I N T E G E R )  
 R E T U R N S   B I G I N T   A S   $ $  
 D E C L A R E  
     v _ c o n v e r s i o n _ r a t e   N U M E R I C ;  
     v _ b a s e _ p a i d _ c o i n s   B I G I N T ;  
     v _ b o n u s _ c o i n s   B I G I N T ;  
 B E G I N  
     v _ c o n v e r s i o n _ r a t e   : =   g e t _ o w c _ c o n v e r s i o n _ r a t e ( p _ l e v e l ) ;  
     v _ b a s e _ p a i d _ c o i n s   : =   F L O O R ( p _ o w c   *   v _ c o n v e r s i o n _ r a t e ) ;  
     v _ b o n u s _ c o i n s   : =   F L O O R ( v _ b a s e _ p a i d _ c o i n s   *   0 . 1 0 ) ;   - -   1 0 %   b o n u s  
     R E T U R N   v _ b a s e _ p a i d _ c o i n s   +   v _ b o n u s _ c o i n s ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   I M M U T A B L E ;  
  
 - -   F u n c t i o n   t o   a w a r d   O W C   f o r   a   w o r k   s e s s i o n  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   a w a r d _ o w c _ f o r _ s e s s i o n (  
     p _ s e s s i o n _ i d   U U I D ,  
     p _ u s e r _ i d   U U I D ,  
     p _ h o u r s _ w o r k e d   N U M E R I C ,  
     p _ o f f i c e r _ l e v e l   I N T E G E R  
 )  
 R E T U R N S   B I G I N T   A S   $ $  
 D E C L A R E  
     v _ o w c _ p e r _ h o u r   B I G I N T ;  
     v _ o w c _ e a r n e d   B I G I N T ;  
 B E G I N  
     v _ o w c _ p e r _ h o u r   : =   g e t _ o w c _ p e r _ h o u r ( p _ o f f i c e r _ l e v e l ) ;  
     v _ o w c _ e a r n e d   : =   F L O O R ( v _ o w c _ p e r _ h o u r   *   p _ h o u r s _ w o r k e d ) ;  
  
     - -   U p d a t e   s e s s i o n  
     U P D A T E   o f f i c e r _ w o r k _ s e s s i o n s  
     S E T   o w c _ e a r n e d   =   v _ o w c _ e a r n e d  
     W H E R E   i d   =   p _ s e s s i o n _ i d ;  
  
     - -   U p d a t e   u s e r   p r o f i l e  
     U P D A T E   u s e r _ p r o f i l e s  
     S E T    
         o w c _ b a l a n c e   =   o w c _ b a l a n c e   +   v _ o w c _ e a r n e d ,  
         t o t a l _ o w c _ e a r n e d   =   t o t a l _ o w c _ e a r n e d   +   v _ o w c _ e a r n e d  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     - -   L o g   t r a n s a c t i o n  
     I N S E R T   I N T O   o w c _ t r a n s a c t i o n s   ( u s e r _ i d ,   a m o u n t ,   t r a n s a c t i o n _ t y p e ,   s o u r c e ,   s e s s i o n _ i d )  
     V A L U E S   ( p _ u s e r _ i d ,   v _ o w c _ e a r n e d ,   ' e a r n e d ' ,   ' s h i f t ' ,   p _ s e s s i o n _ i d ) ;  
  
     R E T U R N   v _ o w c _ e a r n e d ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   F u n c t i o n   t o   c o n v e r t   O W C   t o   p a i d   c o i n s  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c o n v e r t _ o w c _ t o _ p a i d (  
     p _ u s e r _ i d   U U I D ,  
     p _ o w c _ a m o u n t   B I G I N T  
 )  
 R E T U R N S   J S O N   A S   $ $  
 D E C L A R E  
     v _ c u r r e n t _ o w c   B I G I N T ;  
     v _ o f f i c e r _ l e v e l   I N T E G E R ;  
     v _ c o n v e r s i o n _ r a t e   N U M E R I C ;  
     v _ b a s e _ p a i d _ c o i n s   B I G I N T ;  
     v _ b o n u s _ c o i n s   B I G I N T ;  
     v _ t o t a l _ p a i d _ c o i n s   B I G I N T ;  
 B E G I N  
     - -   G e t   c u r r e n t   O W C   b a l a n c e   a n d   o f f i c e r   l e v e l  
     S E L E C T   o w c _ b a l a n c e ,   o f f i c e r _ l e v e l  
     I N T O   v _ c u r r e n t _ o w c ,   v _ o f f i c e r _ l e v e l  
     F R O M   u s e r _ p r o f i l e s  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     I F   v _ c u r r e n t _ o w c   <   p _ o w c _ a m o u n t   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t ( ' s u c c e s s ' ,   f a l s e ,   ' e r r o r ' ,   ' I n s u f f i c i e n t   O W C   b a l a n c e ' ) ;  
     E N D   I F ;  
  
     I F   v _ o f f i c e r _ l e v e l   I S   N U L L   O R   v _ o f f i c e r _ l e v e l   <   1   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t ( ' s u c c e s s ' ,   f a l s e ,   ' e r r o r ' ,   ' I n v a l i d   o f f i c e r   l e v e l ' ) ;  
     E N D   I F ;  
  
     - -   C a l c u l a t e   c o n v e r s i o n  
     v _ c o n v e r s i o n _ r a t e   : =   g e t _ o w c _ c o n v e r s i o n _ r a t e ( v _ o f f i c e r _ l e v e l ) ;  
     v _ b a s e _ p a i d _ c o i n s   : =   F L O O R ( p _ o w c _ a m o u n t   *   v _ c o n v e r s i o n _ r a t e ) ;  
     v _ b o n u s _ c o i n s   : =   F L O O R ( v _ b a s e _ p a i d _ c o i n s   *   0 . 1 0 ) ;   - -   1 0 %   b o n u s  
     v _ t o t a l _ p a i d _ c o i n s   : =   v _ b a s e _ p a i d _ c o i n s   +   v _ b o n u s _ c o i n s ;  
  
     - -   D e d u c t   O W C   a n d   a d d   p a i d   c o i n s  
     U P D A T E   u s e r _ p r o f i l e s  
     S E T    
         o w c _ b a l a n c e   =   o w c _ b a l a n c e   -   p _ o w c _ a m o u n t ,  
         p a i d _ c o i n _ b a l a n c e   =   C O A L E S C E ( p a i d _ c o i n _ b a l a n c e ,   0 )   +   v _ t o t a l _ p a i d _ c o i n s  
     W H E R E   i d   =   p _ u s e r _ i d ;  
  
     - -   L o g   c o n v e r s i o n   t r a n s a c t i o n  
     I N S E R T   I N T O   o w c _ t r a n s a c t i o n s   (  
         u s e r _ i d ,    
         a m o u n t ,    
         t r a n s a c t i o n _ t y p e ,    
         s o u r c e ,    
         c o n v e r s i o n _ r a t e ,    
         p a i d _ c o i n s _ r e c e i v e d  
     )  
     V A L U E S   (  
         p _ u s e r _ i d ,    
         - p _ o w c _ a m o u n t ,    
         ' c o n v e r t e d ' ,    
         ' m a n u a l _ c o n v e r s i o n ' ,    
         v _ c o n v e r s i o n _ r a t e ,    
         v _ t o t a l _ p a i d _ c o i n s  
     ) ;  
  
     - -   L o g   b o n u s   t r a n s a c t i o n  
     I N S E R T   I N T O   o w c _ t r a n s a c t i o n s   (  
         u s e r _ i d ,    
         a m o u n t ,    
         t r a n s a c t i o n _ t y p e ,    
         s o u r c e ,    
         p a i d _ c o i n s _ r e c e i v e d  
     )  
     V A L U E S   (  
         p _ u s e r _ i d ,    
         v _ b o n u s _ c o i n s ,    
         ' b o n u s ' ,    
         ' c o n v e r s i o n _ b o n u s ' ,    
         v _ b o n u s _ c o i n s  
     ) ;  
  
     R E T U R N   j s o n _ b u i l d _ o b j e c t (  
         ' s u c c e s s ' ,   t r u e ,  
         ' o w c _ c o n v e r t e d ' ,   p _ o w c _ a m o u n t ,  
         ' b a s e _ p a i d _ c o i n s ' ,   v _ b a s e _ p a i d _ c o i n s ,  
         ' b o n u s _ c o i n s ' ,   v _ b o n u s _ c o i n s ,  
         ' t o t a l _ p a i d _ c o i n s ' ,   v _ t o t a l _ p a i d _ c o i n s ,  
         ' c o n v e r s i o n _ r a t e ' ,   v _ c o n v e r s i o n _ r a t e  
     ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   U p d a t e   o f f i c e r   b a d g e   m a p p i n g   f o r   n e w   l e v e l s  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   u p d a t e _ o f f i c e r _ t i e r _ b a d g e ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
     I F   N E W . o f f i c e r _ l e v e l   I S   N O T   N U L L   T H E N  
         N E W . o f f i c e r _ t i e r _ b a d g e   : =   C A S E  
             W H E N   N E W . o f f i c e r _ l e v e l   =   1   T H E N   ' b l u e '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   2   T H E N   ' o r a n g e '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   3   T H E N   ' r e d '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   4   T H E N   ' p u r p l e '  
             W H E N   N E W . o f f i c e r _ l e v e l   =   5   T H E N   ' g o l d '  
             E L S E   ' b l u e '  
         E N D ;  
     E N D   I F ;  
     R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   U p d a t e   e x i s t i n g   o f f i c e r s   t o   h a v e   c o r r e c t   b a d g e  
 U P D A T E   u s e r _ p r o f i l e s  
 S E T   o f f i c e r _ t i e r _ b a d g e   =   C A S E  
     W H E N   o f f i c e r _ l e v e l   =   1   T H E N   ' b l u e '  
     W H E N   o f f i c e r _ l e v e l   =   2   T H E N   ' o r a n g e '  
     W H E N   o f f i c e r _ l e v e l   =   3   T H E N   ' r e d '  
     W H E N   o f f i c e r _ l e v e l   =   4   T H E N   ' p u r p l e '  
     W H E N   o f f i c e r _ l e v e l   =   5   T H E N   ' g o l d '  
     E L S E   ' b l u e '  
 E N D  
 W H E R E   ( i s _ t r o l l _ o f f i c e r   =   T R U E   O R   r o l e   =   ' t r o l l _ o f f i c e r ' )  
 A N D   o f f i c e r _ t i e r _ b a d g e   I S   N U L L ;  
  
 - -   P a y P a l   O n l y   S y s t e m   +   P r o m o   C o d e s  
 - -   R e m o v e   S q u a r e   r e f e r e n c e s ,   a d d   P a y P a l   s u p p o r t ,   a d d   p r o m o   c o d e s  
  
 - -   U p d a t e   c o i n _ t r a n s a c t i o n s   f o r   P a y P a l  
 D O   $ $    
 B E G I N  
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' c o i n _ t r a n s a c t i o n s '   A N D   c o l u m n _ n a m e   =   ' p a y m e n t _ p r o v i d e r ' )   T H E N  
         A L T E R   T A B L E   c o i n _ t r a n s a c t i o n s   A D D   C O L U M N   p a y m e n t _ p r o v i d e r   T E X T ;  
     E N D   I F ;  
      
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' c o i n _ t r a n s a c t i o n s '   A N D   c o l u m n _ n a m e   =   ' p a y p a l _ o r d e r _ i d ' )   T H E N  
         A L T E R   T A B L E   c o i n _ t r a n s a c t i o n s   A D D   C O L U M N   p a y p a l _ o r d e r _ i d   T E X T ;  
     E N D   I F ;  
      
     I F   N O T   E X I S T S   ( S E L E C T   1   F R O M   i n f o r m a t i o n _ s c h e m a . c o l u m n s   W H E R E   t a b l e _ n a m e   =   ' c o i n _ t r a n s a c t i o n s '   A N D   c o l u m n _ n a m e   =   ' a m o u n t _ u s d ' )   T H E N  
         A L T E R   T A B L E   c o i n _ t r a n s a c t i o n s   A D D   C O L U M N   a m o u n t _ u s d   N U M E R I C ( 1 0 , 2 ) ;  
     E N D   I F ;  
 E N D   $ $ ;  
  
 - -   C r e a t e   p r o m o _ c o d e s   t a b l e   i f   i t   d o e s n ' t   e x i s t  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p r o m o _ c o d e s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     c o d e   T E X T   U N I Q U E   N O T   N U L L ,  
     d i s c o u n t _ p e r c e n t   N U M E R I C ( 5 , 2 )   N O T   N U L L   C H E C K   ( d i s c o u n t _ p e r c e n t   > =   0   A N D   d i s c o u n t _ p e r c e n t   < =   1 0 0 ) ,  
     m a x _ u s e s   I N T E G E R ,  
     c u r r e n t _ u s e s   I N T E G E R   D E F A U L T   0 ,  
     e x p i r e s _ a t   T I M E S T A M P T Z ,  
     i s _ a c t i v e   B O O L E A N   D E F A U L T   T R U E ,  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( )  
 ) ;  
  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p r o m o _ c o d e s _ c o d e   O N   p r o m o _ c o d e s ( c o d e ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p r o m o _ c o d e s _ a c t i v e   O N   p r o m o _ c o d e s ( i s _ a c t i v e ,   e x p i r e s _ a t ) ;  
  
 - -   C r e a t e   p r o m o _ c o d e _ u s e s   t a b l e   i f   i t   d o e s n ' t   e x i s t  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p r o m o _ c o d e _ u s e s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     p r o m o _ c o d e _ i d   U U I D   R E F E R E N C E S   p r o m o _ c o d e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     u s e r _ i d   U U I D   R E F E R E N C E S   u s e r _ p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     u s e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     t r a n s a c t i o n _ i d   U U I D   R E F E R E N C E S   c o i n _ t r a n s a c t i o n s ( i d )   O N   D E L E T E   S E T   N U L L  
 ) ;  
  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p r o m o _ c o d e _ u s e s _ u s e r   O N   p r o m o _ c o d e _ u s e s ( u s e r _ i d ) ;  
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ p r o m o _ c o d e _ u s e s _ c o d e   O N   p r o m o _ c o d e _ u s e s ( p r o m o _ c o d e _ i d ) ;  
  
 - -   F u n c t i o n   t o   v a l i d a t e   p r o m o   c o d e  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   v a l i d a t e _ p r o m o _ c o d e ( p _ c o d e   T E X T )  
 R E T U R N S   J S O N   A S   $ $  
 D E C L A R E  
     v _ p r o m o   p r o m o _ c o d e s % R O W T Y P E ;  
     v _ u s e r _ u s e s   I N T E G E R ;  
 B E G I N  
     - -   F i n d   p r o m o   c o d e  
     S E L E C T   *   I N T O   v _ p r o m o  
     F R O M   p r o m o _ c o d e s  
     W H E R E   U P P E R ( c o d e )   =   U P P E R ( p _ c o d e )  
         A N D   i s _ a c t i v e   =   T R U E  
         A N D   ( e x p i r e s _ a t   I S   N U L L   O R   e x p i r e s _ a t   >   N O W ( ) ) ;  
  
     I F   N O T   F O U N D   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t (  
             ' v a l i d ' ,   f a l s e ,  
             ' m e s s a g e ' ,   ' I n v a l i d   o r   e x p i r e d   p r o m o   c o d e '  
         ) ;  
     E N D   I F ;  
  
     - -   C h e c k   m a x   u s e s  
     I F   v _ p r o m o . m a x _ u s e s   I S   N O T   N U L L   A N D   v _ p r o m o . c u r r e n t _ u s e s   > =   v _ p r o m o . m a x _ u s e s   T H E N  
         R E T U R N   j s o n _ b u i l d _ o b j e c t (  
             ' v a l i d ' ,   f a l s e ,  
             ' m e s s a g e ' ,   ' P r o m o   c o d e   h a s   r e a c h e d   m a x i m u m   u s e s '  
         ) ;  
     E N D   I F ;  
  
     R E T U R N   j s o n _ b u i l d _ o b j e c t (  
         ' v a l i d ' ,   t r u e ,  
         ' d i s c o u n t _ p e r c e n t ' ,   v _ p r o m o . d i s c o u n t _ p e r c e n t ,  
         ' c o d e ' ,   v _ p r o m o . c o d e  
     ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   F u n c t i o n   t o   r e c o r d   p r o m o   c o d e   u s e  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e c o r d _ p r o m o _ c o d e _ u s e (  
     p _ c o d e   T E X T ,  
     p _ u s e r _ i d   U U I D ,  
     p _ t r a n s a c t i o n _ i d   U U I D   D E F A U L T   N U L L  
 )  
 R E T U R N S   V O I D   A S   $ $  
 D E C L A R E  
     v _ p r o m o _ i d   U U I D ;  
 B E G I N  
     - -   G e t   p r o m o   c o d e   I D  
     S E L E C T   i d   I N T O   v _ p r o m o _ i d  
     F R O M   p r o m o _ c o d e s  
     W H E R E   U P P E R ( c o d e )   =   U P P E R ( p _ c o d e )  
         A N D   i s _ a c t i v e   =   T R U E ;  
  
     I F   v _ p r o m o _ i d   I S   N U L L   T H E N  
         R A I S E   E X C E P T I O N   ' P r o m o   c o d e   n o t   f o u n d ' ;  
     E N D   I F ;  
  
     - -   R e c o r d   u s e  
     I N S E R T   I N T O   p r o m o _ c o d e _ u s e s   ( p r o m o _ c o d e _ i d ,   u s e r _ i d ,   t r a n s a c t i o n _ i d )  
     V A L U E S   ( v _ p r o m o _ i d ,   p _ u s e r _ i d ,   p _ t r a n s a c t i o n _ i d ) ;  
  
     - -   I n c r e m e n t   u s e   c o u n t  
     U P D A T E   p r o m o _ c o d e s  
     S E T   c u r r e n t _ u s e s   =   c u r r e n t _ u s e s   +   1  
     W H E R E   i d   =   v _ p r o m o _ i d ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   S e e d   p r o m o   c o d e s  
 I N S E R T   I N T O   p r o m o _ c o d e s   ( c o d e ,   d i s c o u n t _ p e r c e n t ,   m a x _ u s e s ,   i s _ a c t i v e )  
 V A L U E S    
     ( ' 2 0 2 5 ' ,   5 ,   N U L L ,   T R U E ) ,  
     ( ' 1 9 0 3 ' ,   1 0 0 ,   N U L L ,   T R U E )  
 O N   C O N F L I C T   ( c o d e )   D O   U P D A T E   S E T  
     d i s c o u n t _ p e r c e n t   =   E X C L U D E D . d i s c o u n t _ p e r c e n t ,  
     i s _ a c t i v e   =   E X C L U D E D . i s _ a c t i v e ;  
  
 