
-- Allow anonymous users to read troll wall posts
DROP POLICY IF EXISTS "Users can view all troll wall posts" ON public.troll_wall_posts;
CREATE POLICY "Users can view all troll wall posts" ON public.troll_wall_posts
    FOR SELECT
    USING (true);

-- Allow anonymous users to read pod rooms
DROP POLICY IF EXISTS "Users can view all pod rooms" ON public.pod_rooms;
CREATE POLICY "Users can view all pod rooms" ON public.pod_rooms
    FOR SELECT
    USING (true);
