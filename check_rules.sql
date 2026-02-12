SELECT rulename, definition
FROM pg_rules
WHERE tablename = 'user_profiles';
