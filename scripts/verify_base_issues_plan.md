# Verification Plan for Base Issues Fix

## 1. SQL Verification
Run the `scripts/verify_base_issues.sql` script in your Supabase SQL Editor to confirm:
- RLS is enabled on all target tables.
- Policies are correctly defined.
- `broadcaster_stats_public` is a standard view.
- Functions have `search_path` set (checked via `proconfig`).

## 2. Runtime Verification
Perform the following actions in the application or via API testing:

### Gift Ledger
- **Action**: User A sends a gift to User B.
- **Verify**: 
  - User A can query `gift_ledger` and see the transaction.
  - User B can query `gift_ledger` and see the transaction.
  - User C (unrelated) CANNOT see the transaction.

### Auction Bids
- **Action**: User A places a bid on an auction.
- **Verify**:
  - User A can see their bid in `auction_bids`.
  - User B (not the bidder) CANNOT see User A's bid (unless User B is the auction owner and logic allows, or if it's strictly private as per policy).

### Stream Seats
- **Action**: User A joins a seat on Stream X (owned by User B).
- **Verify**:
  - User A sees their session in `stream_seat_sessions`.
  - User B (Stream Owner) sees User A's session.
  - User C (Observer) sees the session ONLY if the policy allows (currently restricted to user or owner).

### Public Lookups
- **Action**: Any authenticated user queries `house_upgrades` and `districts`.
- **Verify**: Full list is returned.

### Battles
- **Action**: View active battles list.
- **Verify**: Active battles are visible to authenticated users.

### Broadcaster Stats
- **Action**: View the leaderboard or broadcaster stats.
- **Verify**: Data is returned from `broadcaster_stats_public` or `broadcaster_stats`.

## 3. Performance Check
- Check execution time of key queries.
- Ensure indexes added in the migration are being used (can use `EXPLAIN ANALYZE` in SQL Editor).
