BEGIN;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_officer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_family_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_tasks_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_lounge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrance_effects ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY user_profiles_update_self ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY streams_select ON streams FOR SELECT TO authenticated USING (true);
CREATE POLICY streams_insert_own ON streams FOR INSERT TO authenticated WITH CHECK (broadcaster_id = auth.uid());
CREATE POLICY streams_update_own ON streams FOR UPDATE TO authenticated USING (broadcaster_id = auth.uid()) WITH CHECK (broadcaster_id = auth.uid());

CREATE POLICY messages_select ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY messages_insert_self ON messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY gifts_select ON gifts FOR SELECT TO authenticated USING (true);
-- Inserts handled via SECURITY DEFINER RPC

CREATE POLICY coin_tx_select ON coin_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY coin_tx_insert_self ON coin_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY coin_tx_update_self ON coin_transactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_insert_self ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_delete_self ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY follows_select ON user_follows FOR SELECT TO authenticated USING (follower_id = auth.uid() OR following_id = auth.uid());
CREATE POLICY follows_insert_self ON user_follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());

CREATE POLICY payment_methods_select ON user_payment_methods FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY payment_methods_insert_self ON user_payment_methods FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY payment_methods_update_self ON user_payment_methods FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY applications_select ON applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY applications_insert_self ON applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY payouts_select ON payout_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY payouts_insert_self ON payout_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Admin updates handled via service role RPC or backend

CREATE POLICY stream_reports_select ON stream_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY stream_reports_insert_self ON stream_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY officer_apps_select ON troll_officer_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY officer_apps_insert_self ON troll_officer_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY families_select ON families FOR SELECT TO authenticated USING (true);
CREATE POLICY family_members_select ON family_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY family_members_insert_self ON family_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY troll_families_select ON troll_families FOR SELECT TO authenticated USING (true);
CREATE POLICY troll_family_members_select ON troll_family_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR family_id IN (SELECT family_id FROM troll_family_members WHERE user_id = auth.uid()));

CREATE POLICY tasks_select ON family_tasks_new FOR SELECT TO authenticated USING (true);
CREATE POLICY task_completions_select ON task_completions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY task_completions_insert_self ON task_completions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY lounge_messages_select ON family_lounge_messages FOR SELECT TO authenticated USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY lounge_messages_insert_self ON family_lounge_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY entrance_effects_select ON entrance_effects FOR SELECT TO authenticated USING (true);

COMMIT;
