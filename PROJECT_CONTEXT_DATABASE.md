# 📝 PROJECT_CONTEXT_DATABASE.md

This file tells any AI tool:
🔹 What tables exist
🔹 What they are used for
🔹 Which tables are core vs optional
🔹 Which tables affect streaming, wheel, earnings, gifts, payouts, etc.

🧠 Troll City – AI Context (Database Overview)

💾 Copy and keep in your project (Cursor / Trae / ChatGPT / Claude etc.)

## Core User Data:
- **user_profiles** — main profile table. Stores username, avatar, bio, coin balances, level, role, badges, stream_count, followers, blocks, banned, verification status.
- **profiles** — legacy duplicate profile table (should gradually merge into user_profiles).
- **user_payment_settings** — connected payment data, cashout eligibility, W9, bank, PayPal, Square, Stripe.
- **user_risk_profile** — tracks fraud, abuse, auto-report flags.
- **user_follows**, **user_perks**, **user_entrance_effects** — social behavior, perks, special effects.

## Streaming and Live Rooms:
- **streams** — current and past stream records: title, category, user_id, is_live, start_time, end_time, livekit_room, viewer_count.
- **live_streams** — VIEW showing only active is_live=true streams (RLS disabled currently, fix later).
- **troll_stream_messages** — chat messages and gifts during live streams.
- **messages** — possibly legacy chat or private messages.

## Gift Economy, Payments, and Virtual Currencies:
- **gifts** — definitions of all gift items (name, price, animation level, type: basic, promo, premium).
- **post_gifts** — tracks gifts sent on posts (not live streams).
- **coin_packages** — predefined purchase options ($ → coins).
- **coin_transactions** — core transaction ledger: user_id, amount, reason, gift, purchase, refund, promo.
- **transactions** — older general ledger, may merge into coin_transactions.
- **payment_transactions** — real money events: coin purchases, refunds, payouts.
- **broadcaster_earnings** — processed earnings for streamers after platform fees.
- **payout_requests** — user request to cash-out.
- **payout_tiers** and **platform_fees** — define commission %, min thresholds.

## Special Features:
- **wheel_slices** — slice definitions for wheel (reward type, value, probability).
  - **APPROVED REWARD TYPES ONLY:**
    - `coins` — Give coin balance (normal payout)
    - `jackpot` — Big coin blast with special animation
    - `spins` — Give extra wheel spin (bonus)
    - `effect` — Unlock entrance effect or animation badge (no gifting)
    - `nothing` — "Better luck next time" (loss slice)
  - **FORBIDDEN REWARD TYPES:**
    - gift_item, gift, platform payout
    - Any gift-related logic or promotional payouts
  - **Example Wheel Slice Entries:**
    ```sql
    insert into wheel_slices (label, reward_type, amount, probability, animation_level)
    values
    ('Small Win', 'coins', 100, 0.25, 1),
    ('Medium Win', 'coins', 250, 0.20, 2),
    ('💥 JACKPOT', 'jackpot', 1000, 0.05, 5),
    ('✨ Entrance Effect Unlock', 'effect', null, 0.10, 3),
    ('Extra Spin', 'spins', 1, 0.05, 1),
    ('💀 Better Luck 😭', 'nothing', null, 0.35, 1);
    ```
- **wheel_spins** — user history for wheel spins and limits.
- **special_gift_earnings** — deprecated table (formerly used for SAV/VIVED).
- **troll_gift_items** — cosmetic animation and metadata for gifts.
- **entrance_effects** — visual effects when users join a live stream.
- **officer_chat_messages**, **officer_actions** — Troll Officer system moderation.

## Social / Family / Community:
- **troll_families**, **troll_family_members**, **family_invites** — family/clan systems.
- **troll_family_wars** — scheduled events between families.
- **family_tasks**, **family_lounge_messages** — internal family communication.
- **troll_posts**, **troll_post_comments**, **troll_post_reactions**, **troll_post_views** — social feed.
- **notifications** — system notifications to users.

## AI and Avatar Systems:
- **troll_ai_avatars** — AI-driven digital companions, streaming avatars.
- **troll_dna_profiles** — personality and avatar genetics, progression.
- **troll_drops** — random event drops, treasure boxes.

## Admin and Risk:
- **admin_flags** — flagged users or streams.
- **risk_events** — suspicious logins, gifts, or payout attempts.
- **stream_reports** — user-reported streams or users.
- **support_tickets** — user help requests.

## Platform and Settings:
- **platform_wallet** — treasury for platform-funded payouts.
- **platform_settings** — global parameters (gift caps, tax thresholds, wheel price).
- **revenue_settings** — commission % and streamer share.
- **square_events** — webhook history for Square.
- **rev_settings** — older version of platform fee storage.