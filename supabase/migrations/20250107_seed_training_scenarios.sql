-- Seed training scenarios
INSERT INTO training_scenarios (scenario_type, description, chat_messages, correct_action, points_awarded, difficulty_level)
VALUES
  (
    'Chat Violation',
    'User spamming racial slurs in chat',
    '[
      {"username": "User123", "message": "Hello everyone!", "timestamp": "2024-01-01T12:00:00Z"},
      {"username": "TrollUser", "message": "You are all [slur]", "timestamp": "2024-01-01T12:00:05Z"},
      {"username": "TrollUser", "message": "[slur] [slur]", "timestamp": "2024-01-01T12:00:10Z"}
    ]'::jsonb,
    'ban',
    50,
    1
  ),
  (
    'Scam Attempt',
    'User posting suspicious links claiming free coins',
    '[
      {"username": "Scammer99", "message": "Get 1000 free coins here! bit.ly/scam", "timestamp": "2024-01-01T12:01:00Z"},
      {"username": "Viewer1", "message": "Is this real?", "timestamp": "2024-01-01T12:01:05Z"}
    ]'::jsonb,
    'ban',
    50,
    2
  ),
  (
    'Harassment',
    'User targeting another viewer with insults',
    '[
      {"username": "Bully", "message": "@Viewer1 you are so stupid, uninstall life", "timestamp": "2024-01-01T12:02:00Z"},
      {"username": "Viewer1", "message": "Please stop", "timestamp": "2024-01-01T12:02:05Z"}
    ]'::jsonb,
    'mute',
    30,
    1
  ),
  (
    'Spam',
    'User repeating same message rapidly',
    '[
      {"username": "Spammer", "message": "FOLLOW ME", "timestamp": "2024-01-01T12:03:00Z"},
      {"username": "Spammer", "message": "FOLLOW ME", "timestamp": "2024-01-01T12:03:01Z"},
      {"username": "Spammer", "message": "FOLLOW ME", "timestamp": "2024-01-01T12:03:02Z"}
    ]'::jsonb,
    'mute',
    20,
    1
  ),
  (
    'Subtle Harassment',
    'User making passive-aggressive comments about streamer appearance',
    '[
      {"username": "Troll42", "message": "You look tired today", "timestamp": "2024-01-01T12:04:00Z"},
      {"username": "Troll42", "message": "Maybe you should sleep instead of streaming", "timestamp": "2024-01-01T12:04:05Z"},
      {"username": "Troll42", "message": "Just looking out for you lol", "timestamp": "2024-01-01T12:04:10Z"}
    ]'::jsonb,
    'warn',
    35,
    4
  ),
  (
    'Doxxing Attempt',
    'User sharing what looks like personal address info',
    '[
      {"username": "Stalker", "message": "Hey I know you live at 123 Maple Dr", "timestamp": "2024-01-01T12:05:00Z"},
      {"username": "Stalker", "message": "See you soon", "timestamp": "2024-01-01T12:05:05Z"}
    ]'::jsonb,
    'ban',
    100,
    5
  ),
  (
    'Political Argument',
    'Users arguing about politics but not breaking rules yet',
    '[
      {"username": "LeftWing", "message": "Policy X is the best", "timestamp": "2024-01-01T12:06:00Z"},
      {"username": "RightWing", "message": "No, Policy Y is better", "timestamp": "2024-01-01T12:06:05Z"},
      {"username": "LeftWing", "message": "You clearly do not understand economics", "timestamp": "2024-01-01T12:06:10Z"}
    ]'::jsonb,
    'ignore',
    25,
    4
  ),
  (
    'False Report Bait',
    'User pretending to be underage to bait a ban',
    '[
      {"username": "NewUser", "message": "I am 12 years old", "timestamp": "2024-01-01T12:07:00Z"},
      {"username": "NewUser", "message": "Is this game fun?", "timestamp": "2024-01-01T12:07:05Z"},
      {"username": "NewUser", "message": "Jk I am 25", "timestamp": "2024-01-01T12:07:10Z"}
    ]'::jsonb,
    'warn',
    45,
    3
  ),
  (
    'Solicitation',
    'User trying to sell services in chat',
    '[
      {"username": "Artist", "message": "I do commissions! Check my bio", "timestamp": "2024-01-01T12:08:00Z"},
      {"username": "Artist", "message": "Cheap prices for emotes", "timestamp": "2024-01-01T12:08:05Z"}
    ]'::jsonb,
    'warn',
    20,
    2
  ),
  (
    'Ban Evasion',
    'User claiming to be a banned user',
    '[
      {"username": "User_v2", "message": "They banned my main account lol", "timestamp": "2024-01-01T12:09:00Z"},
      {"username": "User_v2", "message": "Can''t stop me", "timestamp": "2024-01-01T12:09:05Z"}
    ]'::jsonb,
    'ban',
    60,
    4
  );
