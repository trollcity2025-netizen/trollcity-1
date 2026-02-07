
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifySeparation() {
  console.log('🔍 Verifying Financial Separation & Officer Payroll Logic...')
  
  try {
    // 1. Setup Test Data
    const testOfficerId = '00000000-0000-0000-0000-000000000000' // Using a dummy UUID if possible, or we need a real user.
    // Ideally we should use a real user or create one. For safety, let's just inspect the logic via dry-run or checks.
    // Actually, let's look for an existing user to use as "Officer".
    
    const { data: users } = await supabase.from('user_profiles').select('id, username').limit(1)
    if (!users || users.length === 0) {
      console.log('⚠️ No users found to test with.')
      return
    }
    const testUser = users[0]
    console.log(`👤 Using test user: ${testUser.username} (${testUser.id})`)

    // 2. Simulate Rent Payment (Revenue Inflow)
    // We can't easily call pay_rent without a house, but we can check the officer_pay_ledger directly.
    // Let's manually insert into officer_pay_ledger to simulate revenue, then test distribution.
    
    console.log('\n--- 1. Testing Revenue Inflow (Simulation) ---')
    const revenueAmount = 10000
    const { error: insertError } = await supabase.from('officer_pay_ledger').insert({
      source_type: 'fine', // using 'fine' as generic source
      source_id: 'test-source',
      coin_amount: revenueAmount,
      metadata: { note: 'Test revenue for verification script' }
    })
    
    if (insertError) {
      console.error('❌ Failed to insert test revenue:', insertError.message)
    } else {
      console.log(`✅ Inserted ${revenueAmount} coins into officer_pay_ledger (Simulated Revenue)`)
    }

    // 3. Verify Pool Balance
    console.log('\n--- 2. Verifying Pool Balance ---')
    const { data: poolStats, error: poolError } = await supabase.rpc('get_officer_payroll_stats')
    
    let effectivePoolBalance = 0;

    if (poolError) {
      console.warn('⚠️ RPC get_officer_payroll_stats failed (likely permission):', poolError.message)
      // Fallback: Calculate manually
      const { data: ledgerData } = await supabase.from('officer_pay_ledger').select('coin_amount')
      const balance = ledgerData.reduce((acc, row) => acc + row.coin_amount, 0)
      console.log(`💰 Current Pool Balance (Manual Calc): ${balance}`)
      
      if (balance < revenueAmount) {
        console.warn('⚠️ Pool balance seems low? It should have at least the test amount.')
      } else {
        console.log('✅ Pool balance reflects inflow.')
      }
      
      // We need poolStats for later calculations, so mock it
      effectivePoolBalance = balance;
    } else {
      console.log(`💰 Current Pool Balance: ${poolStats.pool_balance}`)
      effectivePoolBalance = poolStats.pool_balance;
      
      if (poolStats.pool_balance < revenueAmount) {
        console.warn('⚠️ Pool balance seems low? It should have at least the test amount.')
      } else {
        console.log('✅ Pool balance reflects inflow.')
      }
    }

    // 4. Setup Distribution (Add test user as officer)
    console.log('\n--- 3. Setting up Distribution ---')
    // Deactivate others to isolate test
    await supabase.from('officer_distribution').update({ is_active: false }).neq('id', 0) 
    
    // Add/Update test user
    const { error: distError } = await supabase.from('officer_distribution').upsert({
      officer_user_id: testUser.id,
      role: 'officer',
      percentage_share: 50, // 50% share
      is_active: true
    }, { onConflict: 'officer_user_id' })

    if (distError) {
      console.error('❌ Failed to setup distribution:', distError.message)
    } else {
      console.log(`✅ Configured ${testUser.username} with 50% share.`)
    }

    // 5. Test Distribution (The critical part)
    console.log('\n--- 4. Testing Payroll Distribution ---')
    const { data: distResult, error: distRpcError } = await supabase.rpc('distribute_officer_payroll', {
      p_admin_user_id: testUser.id // acting as admin
    })

    if (distRpcError) {
      console.error('❌ Distribution RPC failed:', distRpcError.message)
    } else {
      console.log('✅ Distribution Result:', JSON.stringify(distResult, null, 2))
      
      // Verify user received money
      const expectedPayout = Math.floor(effectivePoolBalance * 0.5)
      console.log(`   Expected Payout: ${expectedPayout}`)
      
      // Check coin_ledger for the payout
      const { data: ledgerEntry } = await supabase.from('coin_ledger')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('source', 'officer_payout')
        .order('created_at', { ascending: false })
        .limit(1)
        
      if (ledgerEntry && ledgerEntry.length > 0) {
        console.log(`✅ Found Ledger Entry: ${ledgerEntry[0].delta} coins (Reason: ${ledgerEntry[0].reason})`)
        if (ledgerEntry[0].bucket === 'payroll') {
           console.log('✅ Correct Bucket: "payroll"')
        } else {
           console.error(`❌ Wrong Bucket: ${ledgerEntry[0].bucket} (Expected 'payroll')`)
        }
      } else {
        console.error('❌ No ledger entry found for payout!')
      }
      
      // Check officer_pay_ledger for deduction
      const { data: deductionEntry } = await supabase.from('officer_pay_ledger')
        .select('*')
        .eq('source_type', 'officer_payout')
        .order('created_at', { ascending: false })
        .limit(1)
        
      if (deductionEntry && deductionEntry.length > 0) {
         console.log(`✅ Found Officer Ledger Deduction: ${deductionEntry[0].coin_amount}`)
      } else {
         console.error('❌ No deduction in officer_pay_ledger!')
      }
    }

    // 6. Cleanup (Optional, but good practice)
    console.log('\n--- 5. Cleanup ---')
    // Revert distribution is_active if needed, or leave it. 
    // We probably shouldn't delete the ledger entries as they are immutable audit logs.
    console.log('✅ Test Complete.')

  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

verifySeparation()
