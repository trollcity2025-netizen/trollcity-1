DO $$
DECLARE
    -- The list of user IDs to delete
    target_users UUID[] := ARRAY[
        'dd371b89-8e9c-4121-9186-143f0fc65548'::UUID,
        'b50e5cfb-bfea-4ca5-9408-22f25980529c'::UUID,
        '519e9ad7-1635-4b52-bdaf-b416e11e63ad'::UUID,
        '450054d5-36b6-4fd2-880f-6a955433736f'::UUID,
        '24cd991a-bc66-4935-95b7-31d19b794344'::UUID,
        '14e7f00b-0f3e-45c0-8f3e-5b700f7f3574'::UUID
    ];
    user_id UUID;
BEGIN
    FOREACH user_id IN ARRAY target_users
    LOOP
        RAISE NOTICE 'Deleting user: %', user_id;

        -- 1. Financial & Transactions (High dependency)
        -- Using simple DELETE statements instead of nested procedures for compatibility
        BEGIN
            DELETE FROM public.wallet_transactions WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.coin_transactions WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.coin_ledger WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.coin_ledger WHERE to_userid = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.wallets WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.manual_coin_orders WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.payouts WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.payout_requests WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_tax_info WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.admin_pool_transactions WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.purchase_ledger WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_troll_mart_purchases WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.court_payments WHERE defendant_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 2. Social & Content
        BEGIN
            DELETE FROM public.troll_posts WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_wall_posts WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.daily_login_posts WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.posts WHERE author_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.comments WHERE author_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.comments WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_post_reactions WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_post_views WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.likes WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.post_likes WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- Relationships
        BEGIN
            DELETE FROM public.follows WHERE follower_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.follows WHERE following_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.friendships WHERE user_id_1 = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.friendships WHERE user_id_2 = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.conversation_members WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.messages WHERE sender_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.notifications WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 3. Broadcasts & Pods
        BEGIN
            DELETE FROM public.pod_chat_messages WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.pod_bans WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.pod_room_participants WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.pod_episodes WHERE host_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.pod_rooms WHERE host_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.broadcast_viewers WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.broadcast_cohosts WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.broadcast_bans WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.stream_mutes WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.stream_moderators WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.stream_gifts WHERE sender_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.stream_gifts WHERE recipient_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 4. Assets & Inventory
        BEGIN
            DELETE FROM public.user_cars WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_items WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_entrance_effects WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_active_items WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_avatar_customization WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.creator_migration_claims WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 5. Legal & Court
        BEGIN
            DELETE FROM public.court_cases WHERE defendant_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.court_cases WHERE plaintiff_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.court_cases WHERE accuser_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_court_cases WHERE judge_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_court_cases WHERE assigned_judge_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.troll_court_cases WHERE prosecutor_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.court_sentences WHERE judge_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 6. Officer & Roles
        BEGIN
            DELETE FROM public.officer_applications WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.officer_strikes WHERE officer_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.officer_strikes WHERE issued_by = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.officer_shifts WHERE officer_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_roles WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_role_grants WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_role_grants WHERE granted_by = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.user_role_grants WHERE revoked_by = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 7. Onboarding
        BEGIN
            DELETE FROM public.onboarding_progress WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.onboarding_events WHERE user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 8. Logs (Lowest Priority)
        BEGIN
            DELETE FROM public.action_logs WHERE actor_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.moderation_logs WHERE target_user_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        BEGIN
            DELETE FROM public.moderation_logs WHERE moderator_id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- 9. Profiles & Auth
        -- Delete user_profiles first (usually references auth.users)
        BEGIN
            DELETE FROM public.user_profiles WHERE id = user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- Delete from auth.users
        BEGIN
            DELETE FROM auth.users WHERE id = user_id;
        EXCEPTION 
            WHEN OTHERS THEN RAISE NOTICE 'Error deleting from auth.users for %: %', user_id, SQLERRM;
        END;
        
    END LOOP;
END $$;
