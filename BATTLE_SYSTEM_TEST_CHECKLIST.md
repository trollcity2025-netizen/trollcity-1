# Battle System Test Checklist

## Overview
This checklist is for manually testing the battle system with 10 users:
- **Users 1-2**: Broadcasters (start streams and battles)
- **Users 3-4**: Guests (join broadcasts as guests)  
- **Users 5-6**: Gifters (send gifts during battle)
- **Users 7-8**: Chat users (send chat messages)
- **Users 9-10**: Viewers (watch battle)

## Pre-Test Setup

### Database Verification
- [ ] Battles table exists with columns: id, challenger_stream_id, opponent_stream_id, status, winner_stream_id, score_challenger, score_opponent, created_at, started_at, ended_at
- [ ] battle_participants table exists
- [ ] streams table has battle_id and is_battle columns
- [ ] All RPC functions exist: create_battle_challenge, accept_battle, end_battle_guarded, leave_battle, register_battle_score, distribute_battle_winnings
- [ ] RLS policies are configured for battles table

### Gift System
- [ ] gifts table has test gifts seeded
- [ ] send_gift_in_stream RPC works
- [ ] Gift animations trigger correctly

### Chat System
- [ ] messages table accepts chat messages
- [ ] Realtime subscriptions work for chat

---

## Test 1: Battle Creation

### Steps:
1. **User 1** goes to `/go-live` and starts a stream in Trollmers category
2. **User 2** goes to `/go-live` and starts a stream in Trollmers category
3. **User 1** clicks "Start Battle" button
4. System matches with **User 2** (or selects random opponent)
5. Battle challenge is created

### Verification:
- [ ] Battle appears in pending status
- [ ] Both streams show "Battle Pending" indicator
- [ ] Battle ID is created in database

---

## Test 2: Battle Acceptance

### Steps:
1. **User 2** sees battle challenge notification
2. **User 2** clicks "Accept Battle"
3. Battle becomes active

### Verification:
- [ ] Battle status changes to 'active'
- [ ] Both streams show "LIVE - BATTLE" indicator
- [ ] started_at timestamp is set
- [ ] Both streams have is_battle = true
- [ ] battle_participants records created for both users

---

## Test 3: Guest Joining

### Steps:
1. **User 3** joins **User 1's** stream as guest
2. **User 4** joins **User 2's** stream as guest

### Verification:
- [ ] Guests appear in participant list
- [ ] Guests can see both broadcaster videos
- [ ] Guests can hear audio from both sides

---

## Test 4: Gifting During Battle

### Steps:
1. **User 5** opens gift tray in battle view
2. **User 5** sends a gift to **User 1**
3. **User 6** sends a gift to **User 2**

### Verification:
- [ ] Gift animations play on both sides
- [ ] Battle scores update correctly (gifts add to score)
- [ ] Gift recipient receives coins
- [ ] Gift sender's balance decreases
- [ ] Gift appears in stream_gifts table with battle context

### Gift Value to Score Mapping:
- Small gifts (1-10 coins) = 1 point
- Medium gifts (11-100 coins) = 10 points  
- Large gifts (100+ coins) = 50 points

---

## Test 5: Chat During Battle

### Steps:
1. **User 7** types message in battle chat
2. **User 8** types message in battle chat

### Verification:
- [ ] Messages appear in real-time
- [ ] Messages show username and timestamp
- [ ] Chat scrolls automatically to newest
- [ ] Messages persist in messages table

---

## Test 6: Battle Timer

### Steps:
1. Watch the battle timer countdown

### Verification:
- [ ] Timer starts at 3:00 (180 seconds)
- [ ] Timer counts down correctly
- [ ] At 0:00, sudden death begins (10 seconds)
- [ ] After sudden death, battle auto-ends

---

## Test 7: Battle Score Updates

### Steps:
1. During battle, observe score updates

### Verification:
- [ ] Score bar shows live percentage
- [ ] Scores update in real-time
- [ ] Pot total updates correctly

---

## Test 8: Realtime Updates

### Steps:
1. Open battle in multiple browser tabs/devices

### Verification:
- [ ] Score updates sync across all clients
- [ ] Gift animations sync across all clients
- [ ] Chat messages sync across all clients
- [ ] Participant join/leave syncs

---

## Test 9: Battle End

### Steps:
1. Wait for timer to end OR click "End Battle" as host

### Verification:
- [ ] Battle status changes to 'ended'
- [ ] ended_at timestamp is set
- [ ] Winner is displayed correctly
- [ ] Results overlay appears
- [ ] Winnings are calculated

---

## Test 10: Winnings Distribution

### Steps:
1. After battle ends, verify winnings

### Verification:
- [ ] Winner receives battle pot
- [ ] Loser receives nothing (or consolation)
- [ ] Leaderboard updates
- [ ] Notifications sent to winners

---

## Test 11: Leave Battle

### Steps:
1. As a host, click "Leave Battle"

### Verification:
- [ ] Confirmation dialog appears
- [ ] On confirm, battle ends
- [ ] Opponent is declared winner
- [ ] Leaver receives forfeit message

---

## Test 12: Battle Skip

### Steps:
1. When matched with opponent, click "Skip"

### Verification:
- [ ] New opponent is searched
- [ ] Skip is recorded in database
- [ ] User can continue browsing

---

## Known Issues to Check

### Potential Bugs:
1. **Battle not starting**: Check if both streams are live
2. **Scores not updating**: Verify register_battle_score RPC
3. **Gifts not counting**: Check gift → score mapping logic
4. **Chat delays**: Check realtime subscription status
5. **Timer issues**: Verify started_at is set correctly
6. **Winnings not distributing**: Check distribute_battle_winnings RPC
7. **Stream disconnect**: Check Agora token generation
8. **Guest visibility**: Check battle_participants table

### Edge Cases:
- [ ] Battle with 0 gifts (should still end normally)
- [ ] Battle with one side leaving early
- [ ] Battle during network interruption
- [ ] Multiple rapid gifts (rate limiting)
- [ ] Guest trying to start battle (should fail)

---

## Test Completion

### Summary:
- Total Tests: 12
- Pass: ___
- Fail: ___
- Notes: ___

### Issues Found:
1. ___
2. ___
3. ___

### Recommendations:
1. ___
2. ___
