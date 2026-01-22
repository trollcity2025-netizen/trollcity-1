-- Fix RLS policies to use (select auth.uid()) for performance optimization

-- empire_applications
DROP POLICY IF EXISTS "empire_applications_insert_own" ON "public"."empire_applications";
CREATE POLICY "empire_applications_insert_own" ON "public"."empire_applications" 
FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");

DROP POLICY IF EXISTS "empire_applications_select_own" ON "public"."empire_applications";
CREATE POLICY "empire_applications_select_own" ON "public"."empire_applications" 
FOR SELECT USING ((select auth.uid()) = "user_id");

DROP POLICY IF EXISTS "empire_applications_update_own" ON "public"."empire_applications";
CREATE POLICY "empire_applications_update_own" ON "public"."empire_applications" 
FOR UPDATE USING ((select auth.uid()) = "user_id") WITH CHECK ((select auth.uid()) = "user_id");

-- troll_family_memberships
DROP POLICY IF EXISTS "Users can join a family" ON "public"."troll_family_memberships";
CREATE POLICY "Users can join a family" ON "public"."troll_family_memberships" 
FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");

DROP POLICY IF EXISTS "Users can leave their family" ON "public"."troll_family_memberships";
CREATE POLICY "Users can leave their family" ON "public"."troll_family_memberships" 
FOR DELETE USING ((select auth.uid()) = "user_id");

-- troll_families
DROP POLICY IF EXISTS "Leaders can update troll_families" ON "public"."troll_families";
CREATE POLICY "Leaders can update troll_families" ON "public"."troll_families" 
FOR UPDATE USING (("leader_id" = (select auth.uid())) OR "public"."check_family_admin"("id", (select auth.uid())));

-- conversation_members
DROP POLICY IF EXISTS "Users can add members to their own conversations" ON "public"."conversation_members";
CREATE POLICY "Users can add members to their own conversations" ON "public"."conversation_members"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."conversations" c
        WHERE c.id = conversation_members.conversation_id
        AND c.created_by = (select auth.uid())
    )
);

DROP POLICY IF EXISTS "members_insert_owner_or_self" ON "public"."conversation_members";
CREATE POLICY "members_insert_owner_or_self" ON "public"."conversation_members"
FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.created_by = (select auth.uid())
    )
);

-- pitch_contests
-- Fix admin policies to use (select auth.uid())
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pitch_contests') THEN
        
        -- Admins can manage contests
        DROP POLICY IF EXISTS "Admins can manage contests" ON "public"."pitch_contests";
        CREATE POLICY "Admins can manage contests" ON "public"."pitch_contests" 
        FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        -- admins can insert pitch contests
        DROP POLICY IF EXISTS "admins can insert pitch contests" ON "public"."pitch_contests";
        CREATE POLICY "admins can insert pitch contests" ON "public"."pitch_contests" 
        FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        -- admins can read pitch contests
        DROP POLICY IF EXISTS "admins can read pitch contests" ON "public"."pitch_contests";
        CREATE POLICY "admins can read pitch contests" ON "public"."pitch_contests" 
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        -- admins can update pitch contests
        DROP POLICY IF EXISTS "admins can update pitch contests" ON "public"."pitch_contests";
        CREATE POLICY "admins can update pitch contests" ON "public"."pitch_contests" 
        FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        -- create pitch contests (assuming auth users or admins)
        DROP POLICY IF EXISTS "create pitch contests" ON "public"."pitch_contests";
        CREATE POLICY "create pitch contests" ON "public"."pitch_contests" 
        FOR INSERT WITH CHECK (created_by = (select auth.uid()));

        -- Let's try to fix 'update own pitch contests' as it's standard.
        DROP POLICY IF EXISTS "update own pitch contests" ON "public"."pitch_contests";
        CREATE POLICY "update own pitch contests" ON "public"."pitch_contests" 
        FOR UPDATE USING (created_by = (select auth.uid())) WITH CHECK (created_by = (select auth.uid()));

        -- pitch_contests_admin_insert/select/update
        DROP POLICY IF EXISTS "pitch_contests_admin_insert" ON "public"."pitch_contests";
        CREATE POLICY "pitch_contests_admin_insert" ON "public"."pitch_contests" 
        FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        DROP POLICY IF EXISTS "pitch_contests_admin_select" ON "public"."pitch_contests";
        CREATE POLICY "pitch_contests_admin_select" ON "public"."pitch_contests" 
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

        DROP POLICY IF EXISTS "pitch_contests_admin_update" ON "public"."pitch_contests";
        CREATE POLICY "pitch_contests_admin_update" ON "public"."pitch_contests" 
        FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));

    END IF;
END $$;

DO $$
BEGIN
    -- officer_shift_logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'officer_shift_logs') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_logs' AND policyname = 'Officer shift logs view') THEN
             DROP POLICY "Officer shift logs view" ON "public"."officer_shift_logs";
             CREATE POLICY "Officer shift logs view" ON "public"."officer_shift_logs" 
             FOR SELECT USING (("officer_id" = (select auth.uid())) OR (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true))));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_logs' AND policyname = 'Officers can insert own shift logs') THEN
             DROP POLICY "Officers can insert own shift logs" ON "public"."officer_shift_logs";
             CREATE POLICY "Officers can insert own shift logs" ON "public"."officer_shift_logs" 
             FOR INSERT WITH CHECK (("officer_id" = (select auth.uid())) AND (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true))));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_logs' AND policyname = 'Officers can update own shift logs') THEN
             DROP POLICY "Officers can update own shift logs" ON "public"."officer_shift_logs";
             CREATE POLICY "Officers can update own shift logs" ON "public"."officer_shift_logs" 
             FOR UPDATE USING (("officer_id" = (select auth.uid())) OR (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true))));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_logs' AND policyname = 'Officers can view own shift logs') THEN
             DROP POLICY "Officers can view own shift logs" ON "public"."officer_shift_logs";
             CREATE POLICY "Officers can view own shift logs" ON "public"."officer_shift_logs" 
             FOR SELECT USING (("officer_id" = (select auth.uid())) OR (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true))));
        END IF;
    END IF;

    -- ticket_messages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_messages') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'Admins can add ticket messages') THEN
             DROP POLICY "Admins can add ticket messages" ON "public"."ticket_messages";
             CREATE POLICY "Admins can add ticket messages" ON "public"."ticket_messages" 
             FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'Admins can view all ticket messages') THEN
             DROP POLICY "Admins can view all ticket messages" ON "public"."ticket_messages";
             CREATE POLICY "Admins can view all ticket messages" ON "public"."ticket_messages" 
             FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'Users can add ticket messages') THEN
             DROP POLICY "Users can add ticket messages" ON "public"."ticket_messages";
             CREATE POLICY "Users can add ticket messages" ON "public"."ticket_messages" 
             FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = (select auth.uid())));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_messages' AND policyname = 'Users can view ticket messages') THEN
             DROP POLICY "Users can view ticket messages" ON "public"."ticket_messages";
             CREATE POLICY "Users can view ticket messages" ON "public"."ticket_messages" 
             FOR SELECT USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_messages.ticket_id AND t.user_id = (select auth.uid())));
        END IF;
    END IF;

    -- system_errors
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_errors') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_errors' AND policyname = 'Admins can view errors') THEN
             DROP POLICY "Admins can view errors" ON "public"."system_errors";
             CREATE POLICY "Admins can view errors" ON "public"."system_errors" 
             FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'admin' OR is_admin = true)));
        END IF;
    END IF;

    -- coin_transactions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coin_transactions') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_transactions' AND policyname = 'coin_transactions_user_read') THEN
             DROP POLICY "coin_transactions_user_read" ON "public"."coin_transactions";
             CREATE POLICY "coin_transactions_user_read" ON "public"."coin_transactions" 
             FOR SELECT USING ((select auth.uid()) = user_id);
        END IF;
    END IF;

    -- officer_chat_messages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'officer_chat_messages') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_chat_messages' AND policyname = 'Officer chat insert') THEN
             DROP POLICY "Officer chat insert" ON "public"."officer_chat_messages";
             CREATE POLICY "Officer chat insert" ON "public"."officer_chat_messages" 
             FOR INSERT WITH CHECK (("user_id" = (select auth.uid())) AND (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true))));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_chat_messages' AND policyname = 'Officer chat select') THEN
             DROP POLICY "Officer chat select" ON "public"."officer_chat_messages";
             CREATE POLICY "Officer chat select" ON "public"."officer_chat_messages" 
             FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true)));
        END IF;
    END IF;

    -- user_insurances
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_insurances') THEN
        DROP POLICY IF EXISTS "Users can update their own insurances" ON "public"."user_insurances";
        CREATE POLICY "Users can update their own insurances" ON "public"."user_insurances" 
        FOR UPDATE USING ((select auth.uid()) = "user_id");

        DROP POLICY IF EXISTS "Users can view their own insurances" ON "public"."user_insurances";
        CREATE POLICY "Users can view their own insurances" ON "public"."user_insurances" 
        FOR SELECT USING ((select auth.uid()) = "user_id");

        DROP POLICY IF EXISTS "insurance_insert" ON "public"."user_insurances";
        DROP POLICY IF EXISTS "Users can insert their own insurances" ON "public"."user_insurances";
        CREATE POLICY "Users can insert their own insurances" ON "public"."user_insurances" 
        FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");
    END IF;

    -- user_perks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_perks') THEN
        DROP POLICY IF EXISTS "Users can update their own perks" ON "public"."user_perks";
        CREATE POLICY "Users can update their own perks" ON "public"."user_perks" 
        FOR UPDATE USING ((select auth.uid()) = "user_id");

        DROP POLICY IF EXISTS "Users can view their own perks" ON "public"."user_perks";
        CREATE POLICY "Users can view their own perks" ON "public"."user_perks" 
        FOR SELECT USING ((select auth.uid()) = "user_id");

        DROP POLICY IF EXISTS "perks_insert" ON "public"."user_perks";
        DROP POLICY IF EXISTS "Users can insert their own perks" ON "public"."user_perks";
        CREATE POLICY "Users can insert their own perks" ON "public"."user_perks" 
        FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");
    END IF;

END $$;

-- Fixes for tables found in fix1 and trollg.sql

-- coin_ledger
DROP POLICY IF EXISTS "Users can view their coin ledger" ON "public"."coin_ledger";
CREATE POLICY "Users can view their coin ledger" ON "public"."coin_ledger" 
FOR SELECT USING ((select auth.uid()) = "user_id");

-- Proactively fixing other policies mentioned or visible
DO $$
BEGIN
    -- coin_ledger extra policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_ledger' AND policyname = 'Secretary can view all ledgers') THEN
        DROP POLICY "Secretary can view all ledgers" ON "public"."coin_ledger";
        CREATE POLICY "Secretary can view all ledgers" ON "public"."coin_ledger" 
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'secretary' OR role = 'admin' OR is_admin = true)));
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_ledger' AND policyname = 'Users can view own ledger') THEN
        DROP POLICY "Users can view own ledger" ON "public"."coin_ledger";
        CREATE POLICY "Users can view own ledger" ON "public"."coin_ledger" 
        FOR SELECT USING ((select auth.uid()) = "user_id");
    END IF;

    -- trollg_applications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trollg_applications') THEN
        DROP POLICY IF EXISTS "Users can view own TrollG application" ON "public"."trollg_applications";
        CREATE POLICY "Users can view own TrollG application" ON "public"."trollg_applications" 
        FOR SELECT USING ((select auth.uid()) = "user_id");
    END IF;

    -- user_gifts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_gifts') THEN
        DROP POLICY IF EXISTS "Creators can manage own gifts" ON "public"."user_gifts";
        CREATE POLICY "Creators can manage own gifts" ON "public"."user_gifts" 
        FOR ALL USING ((select auth.uid()) = "creator_id") WITH CHECK ((select auth.uid()) = "creator_id");
    END IF;

    -- gift_votes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_votes') THEN
        DROP POLICY IF EXISTS "Users can insert own gift votes" ON "public"."gift_votes";
        CREATE POLICY "Users can insert own gift votes" ON "public"."gift_votes" 
        FOR INSERT WITH CHECK ((select auth.uid()) = "voter_id");
    END IF;

    -- user_event_dismissals
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_event_dismissals') THEN
        DROP POLICY IF EXISTS "Users can insert their event dismissals" ON "public"."user_event_dismissals";
        CREATE POLICY "Users can insert their event dismissals" ON "public"."user_event_dismissals" 
        FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");

        DROP POLICY IF EXISTS "Users can view their event dismissals" ON "public"."user_event_dismissals";
        CREATE POLICY "Users can view their event dismissals" ON "public"."user_event_dismissals" 
        FOR SELECT USING ((select auth.uid()) = "user_id");
    END IF;

    -- court_cases
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'court_cases') THEN
        -- Officers can create cases
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'court_cases' AND policyname = 'Officers can create cases') THEN
             DROP POLICY "Officers can create cases" ON "public"."court_cases";
             CREATE POLICY "Officers can create cases" ON "public"."court_cases" 
             FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true)));
        END IF;

        -- Staff manage cases
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'court_cases' AND policyname = 'Staff manage cases') THEN
             DROP POLICY "Staff manage cases" ON "public"."court_cases";
             CREATE POLICY "Staff manage cases" ON "public"."court_cases" 
             FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true)));
        END IF;
    END IF;

    -- court_dockets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'court_dockets') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'court_dockets' AND policyname = 'Staff manage dockets') THEN
             DROP POLICY "Staff manage dockets" ON "public"."court_dockets";
             CREATE POLICY "Staff manage dockets" ON "public"."court_dockets" 
             FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (select auth.uid()) AND (role = 'troll_officer' OR role = 'lead_troll_officer' OR role = 'admin' OR is_admin = true)));
        END IF;
    END IF;

    -- officer_applications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'officer_applications') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_applications' AND policyname = 'Enable insert for authenticated users only') THEN
             DROP POLICY "Enable insert for authenticated users only" ON "public"."officer_applications";
             CREATE POLICY "Enable insert for authenticated users only" ON "public"."officer_applications" 
             FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
        END IF;
    END IF;

    -- family_members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Users can join families') THEN
            DROP POLICY "Users can join families" ON "public"."family_members";
            CREATE POLICY "Users can join families" ON "public"."family_members" 
            FOR INSERT WITH CHECK ((select auth.uid()) = "user_id");
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Users can view members of their families') THEN
            DROP POLICY "Users can view members of their families" ON "public"."family_members";
            CREATE POLICY "Users can view members of their families" ON "public"."family_members" 
            FOR SELECT USING (EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = family_members.family_id AND m.user_id = (select auth.uid())));
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Users can view own membership') THEN
            DROP POLICY "Users can view own membership" ON "public"."family_members";
            CREATE POLICY "Users can view own membership" ON "public"."family_members" 
            FOR SELECT USING ((select auth.uid()) = "user_id");
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Leaders can manage family members') THEN
            DROP POLICY "Leaders can manage family members" ON "public"."family_members";
            CREATE POLICY "Leaders can manage family members" ON "public"."family_members" 
            FOR ALL USING (EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = family_members.family_id AND m.user_id = (select auth.uid()) AND m.role = 'leader'));
        END IF;
    END IF;

    -- payouts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payouts' AND policyname = 'payouts_self_select') THEN
            DROP POLICY "payouts_self_select" ON "public"."payouts";
            CREATE POLICY "payouts_self_select" ON "public"."payouts" FOR SELECT USING ((select auth.uid()) = user_id);
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payouts' AND policyname = 'payouts_self_insert') THEN
            DROP POLICY "payouts_self_insert" ON "public"."payouts";
            CREATE POLICY "payouts_self_insert" ON "public"."payouts" FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;
