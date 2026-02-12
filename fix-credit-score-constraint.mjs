// Quick script to fix credit score constraint
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCreditScoreConstraint() {
  console.log('Fixing credit score constraint...');
  
  try {
    // Drop the old constraint
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        DECLARE
          constraint_name TEXT;
        BEGIN
          -- Find existing credit_score check constraint
          SELECT tc.constraint_name INTO constraint_name
          FROM information_schema.table_constraints tc
          WHERE tc.table_name = 'user_profiles'
          AND tc.constraint_type = 'CHECK'
          AND tc.constraint_name LIKE '%credit_score%'
          LIMIT 1;
          
          -- Drop it if it exists
          IF constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT ' || constraint_name;
            RAISE NOTICE 'Dropped constraint: %', constraint_name;
          END IF;
        END $$;
      `
    });
    
    if (dropError) throw dropError;
    console.log('Old constraint dropped (if existed)');
    
    // Add new constraint
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_credit_score_check 
        CHECK (credit_score >= 0 AND credit_score <= 800);
      `
    });
    
    if (addError) throw addError;
    console.log('New constraint added (0-800 range)');
    
    // Update scores below 400 to 400
    const { error: updateError1 } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE public.user_profiles
        SET credit_score = 400
        WHERE credit_score < 400 AND credit_score IS NOT NULL;
      `
    });
    
    if (updateError1) throw updateError1;
    console.log('Updated low scores to 400');
    
    // Set NULL scores to 400
    const { error: updateError2 } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE public.user_profiles
        SET credit_score = 400
        WHERE credit_score IS NULL;
      `
    });
    
    if (updateError2) throw updateError2;
    console.log('Set NULL scores to 400');
    
    console.log('✅ Credit score constraint fixed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCreditScoreConstraint();
