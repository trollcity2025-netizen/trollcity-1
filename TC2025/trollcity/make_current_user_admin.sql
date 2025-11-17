-- Make current user admin and troll officer
-- This will update the currently logged in user to have admin and troll officer permissions

-- First, let's find the current user
SELECT id, username, full_name, role, is_admin, is_troll_officer 
FROM profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = (SELECT email FROM auth.users LIMIT 1))
LIMIT 1;

-- Update the current user to be admin and troll officer
UPDATE profiles 
SET 
    role = 'admin',
    is_admin = true,
    is_troll_officer = true,
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = (SELECT email FROM auth.users LIMIT 1));

-- Verify the update
SELECT id, username, full_name, role, is_admin, is_troll_officer 
FROM profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = (SELECT email FROM auth.users LIMIT 1));