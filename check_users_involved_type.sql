-- Check the users_involved column type in court_cases table
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'court_cases' AND column_name = 'users_involved';
