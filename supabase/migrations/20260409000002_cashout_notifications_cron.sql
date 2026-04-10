
-- Cashout window global notification cron
-- Sends global broadcast notification 10 minutes before cashout window opens

-- Add cron job: Runs every Friday at 1:50 PM MST
SELECT cron.schedule(
  'cashout-window-reminder',
  '50 13 * * 5',  -- At 13:50 on Friday every week (MST)
  $$
    INSERT INTO public.global_notifications (
      title,
      message,
      type,
      priority,
      expires_at,
      created_at
    ) VALUES (
      '🚨 Cashout Window Opening Soon',
      'Cashouts open in 10 minutes! Friday 2:00 PM - 3:00 PM MST. Make sure you have deposited your coins into Cashout Escrow before the window opens.',
      'announcement',
      'high',
      NOW() + INTERVAL '2 hours',
      NOW()
    );
  $$
);

-- Add cron job: Runs when cashout window opens at 2:00 PM MST Friday
SELECT cron.schedule(
  'cashout-window-open',
  '0 14 * * 5',  -- At 14:00 on Friday every week (MST)
  $$
    INSERT INTO public.global_notifications (
      title,
      message,
      type,
      priority,
      expires_at,
      created_at
    ) VALUES (
      '✅ Cashout Window OPEN',
      'Cashouts are now open! Request your payout now. Window closes at 3:00 PM MST.',
      'success',
      'high',
      NOW() + INTERVAL '1 hour',
      NOW()
    );
  $$
);
