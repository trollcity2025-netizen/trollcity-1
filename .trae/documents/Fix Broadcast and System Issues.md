I will fix the issues reported by the user one by one.

### Plan
1.  **Coins in Circulation**:
    -   Modify `economy_summary` view in `supabase/migrations/20270131100000_fix_device_login_policy.sql` to exclude admin balances from the calculation. I will check for `is_admin` or `role = 'admin'` in `user_profiles`.

2.  **Gifts**:
    -   In `src/components/broadcast/GiftTray.tsx`, the query filters by `category = 'gift'`. If no gifts are showing, it might be due to the data or category mismatch. I will inspect the logic and ensure it falls back correctly or check if the category is correct. The user says "no gifts available in this category". This implies `filteredGifts` is empty. I will ensure the default category logic is robust.

3.  **Viewer Count**:
    -   In `src/hooks/useViewerTracking.ts`, the update is throttled to 15s. The user says it "doesn't read correctly or update". I will check if the `streams` table update is actually happening and if the `useLiveViewerCount` hook (used for display) is polling correctly. I will ensure `useViewerTracking` updates the local state immediately for the host.

4.  **Chat Entrance/Exit**:
    -   In `src/components/broadcast/BroadcastChat.tsx`, the presence event listeners (`join`/`leave`) seem correct, but maybe `user_profiles` data is missing in the presence state. I will ensure the `track` call in `useViewerTracking.ts` includes all necessary profile data so the chat component can render the system message.

5.  **Visuals (Entrance Effects)**:
    -   The user says "visual dont show for all it only shows for broadcaster". This likely refers to `BroadcastEffectsLayer.tsx`. It listens to presence `join` events. If other users don't see it, it means they aren't receiving the presence `join` event or the `track` payload is missing the effect. I will verify that `BroadcastEffectsLayer` is mounted for everyone and subscribes to the same channel.

6.  **Guest for Broadcaster**:
    -   "Issue when adding a guest". This is vague, but likely refers to `useStreamSeats.ts` `joinSeat` function. I will ensure permissions and RPC calls are correct.

7.  **Mic Mute**:
    -   In `src/components/broadcast/BroadcastControls.tsx`, `toggleMic` only toggles local state. If the UI doesn't reflect it, it might be due to `useLocalParticipant` state not syncing. I will ensure the button state reflects `isMicrophoneEnabled`.

8.  **Like Counter**:
    -   In `src/components/broadcast/BroadcastControls.tsx`, `handleLike` updates local state but the realtime sync might be missing. I need to ensure `stream.total_likes` (or similar) is updated in the DB and broadcasted. I'll check if there's a realtime subscription for likes or if I need to add one.

9.  **Layout (Broadcast Box)**:
    -   In `src/pages/broadcast/BroadcastPage.tsx` or `BroadcastGrid.tsx`, I will adjust the CSS to ensure the broadcast box touches the bottom of the battle button/viewer counter. This sounds like a padding/margin issue in `MobileBroadcastLayout` or the main grid container.

10. **Chat Latency**:
    -   "Takes a couple of seconds to show". `BroadcastChat.tsx` has optimistic updates. If it's slow, the optimistic update might be failing or not rendering. I will double-check the optimistic update logic (lines 290-315).
    -   "No other viewer guest or broadcaster can see any live chats". This suggests a Realtime Subscription failure. I will verify the channel subscription code (`chat:${streamId}`).

11. **Banned Users Button**:
    -   In `src/components/broadcast/BroadcastControls.tsx`, I will remove the duplicate button.

12. **Perks**:
    -   "Issue with my perks". I will check `togglePerk` in `BroadcastControls.tsx` and ensure it updates `user_perks` correctly.

13. **Battle**:
    -   "Battle accepted loading arena but never starts". In `BattleControls.tsx`, `handleAccept` calls `accept_battle` RPC. If the page doesn't show battle, it means the `streams` table update (setting `battle_id`) isn't triggering a re-render or navigation in `BroadcastPage.tsx`. I will ensure `BroadcastPage` listens for `is_battle` or `battle_id` changes to switch to `BattleView`.

14. **End Stream Button**:
    -   In `src/components/broadcast/BroadcastControls.tsx`, I'll fix the z-index or overflow issue causing the pop-up to be cut off.

### Execution Order
I will apply fixes file by file to minimize context switching and ensure consistency.

1.  **Supabase Migrations**: Fix `economy_summary` view.
2.  **BroadcastChat.tsx**: Fix optimistic updates, presence data for entrance/exit.
3.  **BroadcastControls.tsx**: Fix Mic mute, Like counter, Duplicate Banned button, End Stream button position, Perks.
4.  **useViewerTracking.ts**: Fix viewer count updates.
5.  **BroadcastPage.tsx**: Fix Battle transition and Layout (CSS).
6.  **GiftTray.tsx**: Fix gift visibility.
