#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function runTest() {
  console.log('🧪 Store Transaction Test\n')

  try {
    // 1. Get a test user (create if needed)
    console.log('1️⃣  Setting up test user...')
    const testEmail = `test-store-${Date.now()}@test.local`
    const testPassword = 'TestPassword123!'
    
    const { data: signUpData, error: signUpErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    })

    if (signUpErr && !signUpErr.message.includes('already exists')) {
      throw signUpErr
    }

    const userId = signUpData?.user?.id || (await supabase.auth.signInWithPassword(testEmail, testPassword)).data.user?.id
    if (!userId) throw new Error('Failed to get user ID')
    console.log(`   ✓ User ID: ${userId}`)

    // 2. Ensure user profile exists
    console.log('\n2️⃣  Ensuring user profile...')
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingProfile) {
      await supabase.from('user_profiles').insert({
        id: userId,
        username: `tester_${Date.now()}`,
        role: 'troll',
        paid_coin_balance: 0,
        free_coin_balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    console.log('   ✓ Profile ready')

    // 3. Save a mock card via backend
    console.log('\n3️⃣  Saving mock card via backend...')
    const saveCardRes = await fetch('http://localhost:3001/api/payments/save-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        cardToken: 'mock_4111',
        saveAsDefault: true
      })
    })

    const saveCardData = await saveCardRes.json()
    if (!saveCardRes.ok) {
      throw new Error(`Save card failed: ${JSON.stringify(saveCardData)}`)
    }
    console.log(`   ✓ Card saved: ${saveCardData.method.display_name}`)

    // 4. Get a coin package
    console.log('\n4️⃣  Loading coin package...')
    const { data: packages } = await supabase
      .from('coin_packages')
      .select('*')
      .limit(1)

    if (!packages || packages.length === 0) {
      throw new Error('No coin packages found')
    }
    const pkg = packages[0]
    console.log(`   ✓ Package: ${pkg.name} - ${pkg.coin_amount} coins for $${pkg.price}`)

    // 5. Get initial balance
    console.log('\n5️⃣  Checking initial balance...')
    const { data: profileBefore } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', userId)
      .single()
    console.log(`   ✓ Coins before: ${profileBefore.paid_coin_balance}`)

    // 6. Create payment transaction
    console.log('\n6️⃣  Processing payment...')
    const createPaymentRes = await fetch('http://localhost:3001/api/payments/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        packageId: pkg.id,
        // No sourceId - backend will use default card
      })
    })

    const createPaymentData = await createPaymentRes.json()
    
    if (!createPaymentRes.ok) {
      console.log(`   ✗ Payment failed: ${JSON.stringify(createPaymentData)}`)
      throw new Error(`Payment failed: ${createPaymentData.error} - ${createPaymentData.details}`)
    }

    console.log(`   ✓ Payment ID: ${createPaymentData.payment?.id || 'processing'}`)
    console.log(`   ✓ Coins added: ${createPaymentData.coins_added}`)
    console.log(`   ✓ New balance: ${createPaymentData.new_balance}`)

    // 7. Verify balance updated
    console.log('\n7️⃣  Verifying balance update...')
    const { data: profileAfter } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', userId)
      .single()

    const coinsAdded = profileAfter.paid_coin_balance - profileBefore.paid_coin_balance
    if (coinsAdded !== pkg.coin_amount) {
      throw new Error(`Balance mismatch: expected +${pkg.coin_amount}, got +${coinsAdded}`)
    }
    console.log(`   ✓ Balance updated correctly: ${profileBefore.paid_coin_balance} → ${profileAfter.paid_coin_balance}`)

    // 8. Check coin_transactions table
    console.log('\n8️⃣  Verifying transaction record...')
    const { data: transactions } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'store_purchase')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!transactions || transactions.length === 0) {
      throw new Error('No transaction record found')
    }

    const tx = transactions[0]
    console.log(`   ✓ Transaction ID: ${tx.id}`)
    console.log(`   ✓ Type: ${tx.type}`)
    console.log(`   ✓ Amount: ${tx.amount} coins`)
    console.log(`   ✓ Description: ${tx.description}`)
    console.log(`   ✓ Metadata:`, tx.metadata)

    // 9. Summary
    console.log('\n✅ All tests passed!')
    console.log('\nSummary:')
    console.log(`- User: ${testEmail}`)
    console.log(`- Card saved: Mock Card •••• 4111 (default)`)
    console.log(`- Purchase: ${pkg.name} for $${pkg.price}`)
    console.log(`- Coins credited: +${coinsAdded}`)
    console.log(`- Transaction recorded in DB`)
    console.log(`- Store flow: WORKING ✓`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

runTest()
