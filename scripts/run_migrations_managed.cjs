const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function execSql(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    throw new Error(error.message);
  }
}

async function _tableHasData(_tableName) {
  // We will handle it in SQL
  return false;
}

function sanitizeSql(filename, sql) {
  if (filename.includes('20260204000000_active_asset_economy.sql')) {
    console.log('Sanitizing 00_active_asset_economy.sql...');
    // Wrap houses_catalog INSERT
    // We look for "INSERT INTO public.houses_catalog"
    // And wrap it in a DO block check.
    
    // Regex to find the INSERT block up to ON CONFLICT or ;
    // It's safer to just replace "INSERT INTO public.houses_catalog" with 
    // "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.houses_catalog) THEN INSERT INTO public.houses_catalog"
    // and append "END IF; END $$;" at the end of the statement.
    // But finding the end of the statement is hard with regex.
    
    // Manual approach:
    // The file has:
    // INSERT INTO public.houses_catalog ...
    // ...
    // ON CONFLICT DO NOTHING;
    
    // We can replace "INSERT INTO public.houses_catalog" with:
    // DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.houses_catalog) THEN INSERT INTO public.houses_catalog
    
    // And replace "ON CONFLICT DO NOTHING;" with:
    // ON CONFLICT DO NOTHING; END IF; END $$;
    
    // Same for cars_catalog
    // The cars INSERT ends with "ON CONFLICT DO NOTHING;" as well.
    // Wait, replace will replace the first occurrence only?
    // String.prototype.replace(string, string) replaces only the first occurrence.
    // So the first one was houses, the second one (if I call replace again) will be cars?
    // I need to be careful about order.
    
    // Let's verify the file content structure again.
    // Houses comes first.
    // Cars comes second.
    
    // Actually, cars_catalog insert also has ON CONFLICT DO NOTHING;
    
    // So:
    // 1. Replace first "ON CONFLICT DO NOTHING;" (Houses)
    // 2. Replace second "ON CONFLICT DO NOTHING;" (Cars) - wait, if I replace the first one, the second one becomes the first one in the *next* call?
    // No, I operate on the string.
    
    // Let's use a split approach or safer replacements.
    
    const parts = sql.split('INSERT INTO public.cars_catalog');
    if (parts.length === 2) {
      let housesPart = parts[0];
      let carsPart = 'INSERT INTO public.cars_catalog' + parts[1];
      
      // Fix Houses
      housesPart = housesPart.replace(
        'INSERT INTO public.houses_catalog', 
        'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.houses_catalog) THEN INSERT INTO public.houses_catalog'
      );
      housesPart = housesPart.replace(
        'ON CONFLICT DO NOTHING;', 
        'ON CONFLICT DO NOTHING; END IF; END $$;'
      );
      
      // Fix Cars
      carsPart = carsPart.replace(
        'INSERT INTO public.cars_catalog', 
        'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cars_catalog) THEN INSERT INTO public.cars_catalog'
      );
      carsPart = carsPart.replace(
        'ON CONFLICT DO NOTHING;', 
        'ON CONFLICT DO NOTHING; END IF; END $$;'
      );
      
      return housesPart + carsPart;
    }
  }
  
  if (filename.includes('20260204000006_house_upgrades.sql')) {
    console.log('Sanitizing 06_house_upgrades.sql...');
    // This one ends with just ";" after VALUES (...);
    // It doesn't have ON CONFLICT.
    // And it has "INSERT INTO house_upgrades_catalog"
    
    // I will look for "INSERT INTO house_upgrades_catalog"
    // And wrap the whole statement.
    // The statement ends with a semicolon.
    
    // Strategy:
    // Replace "INSERT INTO house_upgrades_catalog" with "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM house_upgrades_catalog) THEN INSERT INTO house_upgrades_catalog"
    // Replace the LAST semicolon of that statement with "; END IF; END $$;"
    // This is hard to robustly identify.
    
    // Alternative: Just run it. If it duplicates, so be it. 
    // Or try to inject "ON CONFLICT DO NOTHING" if possible.
    // But table doesn't have unique constraint on name.
    
    // Let's try to just inject the check.
    const insertStart = 'INSERT INTO house_upgrades_catalog';
    if (sql.includes(insertStart)) {
       const parts = sql.split(insertStart);
       // parts[0] is before
       // parts[1] is the values part
       
       // Find the next semicolon in parts[1]
       const semiIndex = parts[1].indexOf(';');
       if (semiIndex !== -1) {
         const beforeSemi = parts[1].substring(0, semiIndex);
         const afterSemi = parts[1].substring(semiIndex + 1);
         
         return parts[0] + 
           'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM house_upgrades_catalog) THEN ' + 
           insertStart + beforeSemi + '; END IF; END $$;' + 
           afterSemi;
       }
    }
  }
  
  return sql;
}

async function run() {
  const migrations = [
    'supabase/migrations/20260204000000_active_asset_economy.sql',
    'supabase/migrations/20260204000001_asset_logic.sql',
    'supabase/migrations/20260204000002_purchase_functions.sql',
    'supabase/migrations/20260204000003_rentals_auctions_logic.sql',
    'supabase/migrations/20260204000004_purchase_logic.sql',
    'supabase/migrations/20260204000005_rental_market_policy.sql',
    'supabase/migrations/20260204000006_house_upgrades.sql',
    'supabase/migrations/20260204000007_hotel_tax.sql',
    'supabase/migrations/20270219000000_unified_actionable_notifications.sql'
  ];

  for (const file of migrations) {
    const fullPath = path.resolve(__dirname, '../' + file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${file}`);
      continue;
    }

    console.log(`Processing ${file}...`);
    let sql = fs.readFileSync(fullPath, 'utf8');
    
    sql = sanitizeSql(file, sql);
    
    try {
      await execSql(sql);
      console.log(`✓ Success: ${file}`);
    } catch (e) {
      console.error(`✗ Failed: ${file}`);
      console.error(e.message);
      // We continue even if one fails? 
      // User said "run all". If one fails (e.g. already exists), maybe next one depends on it?
      // But we can't do much.
    }
  }
}

run();
