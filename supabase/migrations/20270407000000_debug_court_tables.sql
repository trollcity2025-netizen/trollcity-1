-- Debug: Check actual table schemas and find ALL tables named court_cases
SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_name IN ('court_cases', 'court_summons', 'court_dockets')
AND t.table_schema = 'public'
ORDER BY t.table_name, c.ordinal_position;

-- Also check if there's a primary key on court_cases
SELECT 
    tc.table_schema,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'court_cases' 
AND tc.table_schema = 'public'
AND tc.constraint_type = 'PRIMARY KEY';