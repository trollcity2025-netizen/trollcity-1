SELECT 
    v.relname AS view_name,
    c.column_name AS column_name
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class v ON v.oid = r.ev_class
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
JOIN pg_class t ON t.oid = d.refobjid
JOIN information_schema.columns c ON c.table_name = t.relname AND c.ordinal_position = a.attnum
WHERE t.relname = 'user_profiles'
AND v.relkind = 'v'
AND c.column_name = 'troll_coins';
