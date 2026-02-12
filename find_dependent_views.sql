SELECT DISTINCT v.schemaname, v.viewname
FROM pg_catalog.pg_views v
JOIN pg_catalog.pg_rewrite r ON r.ev_class = (v.schemaname || '.' || v.viewname)::regclass
JOIN pg_catalog.pg_depend d ON d.objid = r.oid
JOIN pg_catalog.pg_class c ON c.oid = d.refobjid
WHERE c.relname = 'user_profiles'
AND v.schemaname = 'public';
