# Battle Stream Debug Quick Reference

## Console Log Filters

### Battle Component Logs
```
🎮 [BattleView]
```
Shows battle initialization and state updates

### Battle Protection Logs
```
⚔️ Battle mode detected
🛡️ BATTLE ROOM DETECTED
🛡️ IGNORING room_finished
```
Shows when battle protection is triggered

### Stream End Listener
```
[useStreamEndListener]
```
Shows when streams are detected as ended

## Database Queries for Debugging

### Check Active Battles
```sql
SELECT 
  b.id,
  b.status,
  b.started_at,
  cs.id as challenger_stream,
  cs.is_live as challenger_live,
  cs.battle_id as challenger_battle_id,
  os.id as opponent_stream,
  os.is_live as opponent_live,
  os.battle_id as opponent_battle_id
FROM battles b
LEFT JOIN streams cs ON b.challenger_stream_id = cs.id
LEFT JOIN streams os ON b.opponent_stream_id = os.id
WHERE b.status IN ('pending', 'active')
ORDER BY b.started_at DESC;
```

### Check Stream End Audit Trail
```sql
SELECT 
  action,
  user_id,
  details,
  created_at
FROM audit_logs
WHERE action LIKE 'end_stream%'
  OR action LIKE '%battle%'
ORDER BY created_at DESC
LIMIT 20;
```

### Check if Stream is in Battle
```sql
SELECT 
  id,
  is_live,
  status,
  battle_id,
  is_stream_in_battle(id) as currently_in_battle
FROM streams
WHERE battle_id IS NOT NULL;
```

### Find Orphaned Battle References
```sql
-- Streams with battle_id but no matching active battle
SELECT 
  s.id as stream_id,
  s.battle_id,
  s.is_live,
  b.status as battle_status
FROM streams s
LEFT JOIN battles b ON s.battle_id = b.id
WHERE s.battle_id IS NOT NULL
  AND (b.id IS NULL OR b.status NOT IN ('pending', 'active'));
```

## API Test Calls

### Try to End Stream in Battle (Should Fail)
```javascript
const { data, error } = await supabase.rpc('end_stream', {
  p_stream_id: 'your-stream-id'
});
// Should return: { success: false, message: "Cannot end stream during active battle..." }
```

### Check Battle Status
```javascript
const { data: battle } = await supabase
  .from('battles')
  .select('*')
  .eq('id', 'battle-id')
  .single();
console.log('Battle status:', battle.status);
```

### Check Stream Battle ID
```javascript
const { data: stream } = await supabase
  .from('streams')
  .select('battle_id, is_live, status')
  .eq('id', 'stream-id')
  .single();
console.log('Stream in battle?', !!stream.battle_id);
```

## LiveKit Webhook Debugging

### Check Webhook Logs in Supabase
1. Go to Supabase Dashboard → Edge Functions → livekit-webhooks
2. Look for recent invocations
3. Search for:
   - `room_finished event for room:`
   - `BATTLE ROOM DETECTED`
   - `IGNORING room_finished`

### Simulate Webhook (Testing)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/livekit-webhooks \
  -H "Authorization: HMAC-SHA256 <signature>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "room_finished",
    "room": {
      "name": "battle-abc-123-def-456"
    }
  }'
```

## Common Issues & Solutions

### Issue: Battle still ending early
**Check:**
1. Is migration applied? `SELECT * FROM pg_proc WHERE proname = 'end_stream'`
2. Are edge functions deployed? Check Supabase dashboard
3. Check audit_logs for what's ending the stream
4. Look for console logs with 🛡️ emoji

### Issue: Can't end stream after battle
**Solution:**
Battle might still be marked as active. End the battle first:
```sql
UPDATE battles 
SET status = 'ended', ended_at = NOW() 
WHERE id = 'battle-id';
```

### Issue: Stream has battle_id but battle doesn't exist
**Solution:**
Clear the orphaned reference:
```sql
UPDATE streams 
SET battle_id = NULL 
WHERE id = 'stream-id' 
AND NOT EXISTS (
  SELECT 1 FROM battles WHERE id = streams.battle_id
);
```

### Issue: No logs appearing
**Check:**
1. Is audit_logs table accessible? `SELECT COUNT(*) FROM audit_logs`
2. Does user have RLS permissions? Check policies
3. Is logging code actually running? Add console.log before INSERT

## Monitoring Queries

### Active Battles Dashboard
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') as pending_battles,
  COUNT(*) FILTER (WHERE status = 'active') as active_battles,
  COUNT(*) FILTER (WHERE status = 'active' AND started_at < NOW() - INTERVAL '5 minutes') as stale_battles,
  COUNT(*) as total_battles
FROM battles
WHERE status IN ('pending', 'active');
```

### Stream Health Check
```sql
SELECT 
  COUNT(*) FILTER (WHERE is_live = true) as live_streams,
  COUNT(*) FILTER (WHERE battle_id IS NOT NULL) as streams_in_battle,
  COUNT(*) FILTER (WHERE is_live = true AND battle_id IS NOT NULL) as live_battle_streams
FROM streams;
```

### Recent Stream Ends
```sql
SELECT 
  s.id,
  s.ended_at,
  s.battle_id,
  a.action,
  a.metadata->>'reason' as end_reason
FROM streams s
LEFT JOIN audit_logs a ON 
  a.action = 'end_stream' 
  AND a.metadata->>'stream_id' = s.id::text
WHERE s.ended_at > NOW() - INTERVAL '1 hour'
ORDER BY s.ended_at DESC;
```

## Emergency Procedures

### Force End All Battles (Emergency Only)
```sql
-- DO NOT USE DURING NORMAL OPERATION
UPDATE battles SET status = 'ended', ended_at = NOW() WHERE status IN ('pending', 'active');
UPDATE streams SET battle_id = NULL WHERE battle_id IS NOT NULL;
```

### Clear All Battle Protection (Recovery)
```sql
-- If battle protection is blocking legitimate stream ends
UPDATE streams SET battle_id = NULL WHERE battle_id IN (
  SELECT id FROM battles WHERE status = 'ended'
);
```

### Reset Stream After Failed Battle
```sql
UPDATE streams 
SET 
  battle_id = NULL,
  is_live = true,
  status = 'live'
WHERE id = 'stream-id';
```

## Performance Monitoring

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname IN (
  'idx_streams_battle_id',
  'idx_battles_status',
  'idx_audit_logs_action'
)
ORDER BY idx_scan DESC;
```

### Slow Query Analysis
```sql
-- Find slow queries involving battles/streams
SELECT 
  query,
  calls,
  total_time / calls as avg_time_ms,
  mean_time
FROM pg_stat_statements
WHERE query ILIKE '%battle%' 
   OR query ILIKE '%stream%'
ORDER BY total_time DESC
LIMIT 10;
```

---

**Quick Command Reference:**
- Deploy webhooks: `supabase functions deploy livekit-webhooks`
- Apply migration: `supabase db push`
- Check logs: `supabase functions logs livekit-webhooks --tail`
- Test RPC: `SELECT end_stream('uuid')`
