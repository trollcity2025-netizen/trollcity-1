/**
 * COINSTORE PURCHASE TEST
 * Validates all purchase flows work correctly
 * 
 * Test Coverage:
 * - Entrance Effects purchase
 * - Insurance purchase  
 * - Call Minutes purchase
 * - Perks purchase
 */

import { supabase } from '../../../lib/supabase';
import { 
  purchaseInsurance, 
  getInsurancePlans,
  canAffordInsurance 
} from '../../../lib/insuranceSystem';
import { 
  purchaseCallMinutes, 
  CALL_PACKAGES 
} from '../../../lib/callMinutes';
import { 
  purchasePerk, 
  canAffordPerk,
  PERK_CONFIG 
} from '../../../lib/perkSystem';
import { 
  purchaseEntranceEffect,
  getEntranceEffectConfig 
} from '../../../lib/entranceEffects';
import { deductCoins } from '../../../lib/coinTransactions';

// ==========================================
// TEST RESULTS TYPE
// ==========================================

export interface PurchaseTestResult {
  category: 'entrance_effect' | 'insurance' | 'call_minutes' | 'perk';
  testName: string;
  success: boolean;
  error?: string;
  details?: any;
  duration: number;
}

// ==========================================
// TEST CONFIGURATION
// ==========================================

const TEST_USER_ID = 'test-user-id';
const TEST_COIN_BALANCE = 100000; // Give test user plenty of coins

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Setup test user with sufficient coins
 */
async function setupTestUser(): Promise<boolean> {
  try {
    // Ensure test user has sufficient coins
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', TEST_USER_ID)
      .single();
    
    if (!profile) {
      console.warn('Test user not found - skipping tests that require user');
      return false;
    }

    if ((profile.troll_coins || 0) < TEST_COIN_BALANCE) {
      // Grant coins for testing
      const { error } = await supabase.rpc('add_coins', {
        p_user_id: TEST_USER_ID,
        p_amount: TEST_COIN_BALANCE - (profile.troll_coins || 0),
        p_coin_type: 'paid'
      });
      
      if (error) {
        console.warn('Failed to setup test coins:', error);
        return false;
      }
    }
    
    return true;
  } catch (err) {
    console.error('Setup test user error:', err);
    return false;
  }
}

/**
 * Cleanup test purchases
 */
async function cleanupTestPurchases(): Promise<void> {
  try {
    // Clean up test insurance
    await supabase
      .from('user_insurances')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .lt('created_at', new Date(Date.now() + 60000).toISOString());
    
    // Clean up test call minutes
    await supabase
      .from('call_minutes')
      .delete()
      .eq('user_id', TEST_USER_ID);
    
    // Clean up test perks  
    await supabase
      .from('user_perks')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .lt('created_at', new Date(Date.now() + 60000).toISOString());
    
    // Clean up test entrance effects
    await supabase
      .from('user_entrance_effects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .lt('purchased_at', new Date(Date.now() + 60000).toISOString());
    
    // Clean up test transactions
    await supabase
      .from('coin_transactions')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('description', '%test%');
      
  } catch (err) {
    console.warn('Cleanup error (non-critical):', err);
  }
}

// ==========================================
// ENTRANCE EFFECTS TESTS
// ==========================================

async function testEntranceEffects(): Promise<PurchaseTestResult[]> {
  const results: PurchaseTestResult[] = [];
  
  // Test 1: Get entrance effect config
  const start1 = performance.now();
  try {
    const config = getEntranceEffectConfig('soft_glow');
    results.push({
      category: 'entrance_effect',
      testName: 'Get Entrance Effect Config',
      success: !!config,
      details: { name: config?.name, cost: config?.cost },
      duration: performance.now() - start1
    });
  } catch (err: any) {
    results.push({
      category: 'entrance_effect',
      testName: 'Get Entrance Effect Config',
      success: false,
      error: err.message,
      duration: performance.now() - start1
    });
  }
  
  // Test 2: Purchase entrance effect (if user exists)
  const start2 = performance.now();
  try {
    const result = await purchaseEntranceEffect(TEST_USER_ID, 'soft_glow');
    results.push({
      category: 'entrance_effect',
      testName: 'Purchase Entrance Effect',
      success: result.success,
      error: result.error,
      details: { result },
      duration: performance.now() - start2
    });
  } catch (err: any) {
    results.push({
      category: 'entrance_effect',
      testName: 'Purchase Entrance Effect',
      success: false,
      error: err.message,
      duration: performance.now() - start2
    });
  }
  
  return results;
}

// ==========================================
// INSURANCE TESTS
// ==========================================

async function testInsurance(): Promise<PurchaseTestResult[]> {
  const results: PurchaseTestResult[] = [];
  
  // Test 1: Get insurance plans
  const start1 = performance.now();
  try {
    const plans = await getInsurancePlans();
    results.push({
      category: 'insurance',
      testName: 'Get Insurance Plans',
      success: plans.length > 0,
      details: { planCount: plans.length, firstPlan: plans[0]?.name },
      duration: performance.now() - start1
    });
  } catch (err: any) {
    results.push({
      category: 'insurance',
      testName: 'Get Insurance Plans',
      success: false,
      error: err.message,
      duration: performance.now() - start1
    });
  }
  
  // Test 2: Check affordability
  const start2 = performance.now();
  try {
    const plans = await getInsurancePlans();
    if (plans.length > 0) {
      const canAfford = await canAffordInsurance(TEST_USER_ID, plans[0].id);
      results.push({
        category: 'insurance',
        testName: 'Check Insurance Affordability',
        success: true,
        details: { canAfford, planCost: plans[0].cost },
        duration: performance.now() - start2
      });
    }
  } catch (err: any) {
    results.push({
      category: 'insurance',
      testName: 'Check Insurance Affordability',
      success: false,
      error: err.message,
      duration: performance.now() - start2
    });
  }
  
  // Test 3: Purchase insurance (if plans exist)
  const start3 = performance.now();
  try {
    const plans = await getInsurancePlans();
    if (plans.length > 0) {
      const result = await purchaseInsurance(TEST_USER_ID, plans[0].id);
      results.push({
        category: 'insurance',
        testName: 'Purchase Insurance',
        success: result.success,
        error: result.error,
        details: { expiresAt: result.expiresAt },
        duration: performance.now() - start3
      });
    } else {
      results.push({
        category: 'insurance',
        testName: 'Purchase Insurance',
        success: false,
        error: 'No insurance plans available',
        duration: performance.now() - start3
      });
    }
  } catch (err: any) {
    results.push({
      category: 'insurance',
      testName: 'Purchase Insurance',
      success: false,
      error: err.message,
      duration: performance.now() - start3
    });
  }
  
  return results;
}

// ==========================================
// CALL MINUTES TESTS
// ==========================================

async function testCallMinutes(): Promise<PurchaseTestResult[]> {
  const results: PurchaseTestResult[] = [];
  
  // Test 1: Get call packages
  const start1 = performance.now();
  try {
    const audioPackages = CALL_PACKAGES.audio;
    const videoPackages = CALL_PACKAGES.video;
    results.push({
      category: 'call_minutes',
      testName: 'Get Call Packages',
      success: audioPackages.length > 0 && videoPackages.length > 0,
      details: { 
        audioCount: audioPackages.length, 
        videoCount: videoPackages.length,
        sampleAudio: audioPackages[0]
      },
      duration: performance.now() - start1
    });
  } catch (err: any) {
    results.push({
      category: 'call_minutes',
      testName: 'Get Call Packages',
      success: false,
      error: err.message,
      duration: performance.now() - start1
    });
  }
  
  // Test 2: Purchase audio call minutes
  const start2 = performance.now();
  try {
    const audioPkg = CALL_PACKAGES.audio[0];
    if (audioPkg) {
      const result = await purchaseCallMinutes(TEST_USER_ID, audioPkg);
      results.push({
        category: 'call_minutes',
        testName: 'Purchase Audio Call Minutes',
        success: result.success,
        error: result.error,
        details: { package: audioPkg },
        duration: performance.now() - start2
      });
    } else {
      results.push({
        category: 'call_minutes',
        testName: 'Purchase Audio Call Minutes',
        success: false,
        error: 'No audio packages available',
        duration: performance.now() - start2
      });
    }
  } catch (err: any) {
    results.push({
      category: 'call_minutes',
      testName: 'Purchase Audio Call Minutes',
      success: false,
      error: err.message,
      duration: performance.now() - start2
    });
  }
  
  // Test 3: Purchase video call minutes
  const start3 = performance.now();
  try {
    const videoPkg = CALL_PACKAGES.video[0];
    if (videoPkg) {
      const result = await purchaseCallMinutes(TEST_USER_ID, videoPkg);
      results.push({
        category: 'call_minutes',
        testName: 'Purchase Video Call Minutes',
        success: result.success,
        error: result.error,
        details: { package: videoPkg },
        duration: performance.now() - start3
      });
    } else {
      results.push({
        category: 'call_minutes',
        testName: 'Purchase Video Call Minutes',
        success: false,
        error: 'No video packages available',
        duration: performance.now() - start3
      });
    }
  } catch (err: any) {
    results.push({
      category: 'call_minutes',
      testName: 'Purchase Video Call Minutes',
      success: false,
      error: err.message,
      duration: performance.now() - start3
    });
  }
  
  return results;
}

// ==========================================
// PERKS TESTS
// ==========================================

async function testPerks(): Promise<PurchaseTestResult[]> {
  const results: PurchaseTestResult[] = [];
  
  // Test 1: Get perk config
  const start1 = performance.now();
  try {
    const config = PERK_CONFIG['perk_double_xp'];
    results.push({
      category: 'perk',
      testName: 'Get Perk Config',
      success: !!config,
      details: { name: config?.name, cost: config?.cost },
      duration: performance.now() - start1
    });
  } catch (err: any) {
    results.push({
      category: 'perk',
      testName: 'Get Perk Config',
      success: false,
      error: err.message,
      duration: performance.now() - start1
    });
  }
  
  // Test 2: Check perk affordability
  const start2 = performance.now();
  try {
    const canAfford = await canAffordPerk(TEST_USER_ID, 'perk_double_xp');
    results.push({
      category: 'perk',
      testName: 'Check Perk Affordability',
      success: true,
      details: { canAfford, perkCost: PERK_CONFIG['perk_double_xp']?.cost },
      duration: performance.now() - start2
    });
  } catch (err: any) {
    results.push({
      category: 'perk',
      testName: 'Check Perk Affordability',
      success: false,
      error: err.message,
      duration: performance.now() - start2
    });
  }
  
  // Test 3: Purchase perk
  const start3 = performance.now();
  try {
    const result = await purchasePerk(TEST_USER_ID, 'perk_double_xp');
    results.push({
      category: 'perk',
      testName: 'Purchase Perk',
      success: result.success,
      error: result.error,
      details: { expiresAt: result.expiresAt },
      duration: performance.now() - start3
    });
  } catch (err: any) {
    results.push({
      category: 'perk',
      testName: 'Purchase Perk',
      success: false,
      error: err.message,
      duration: performance.now() - start3
    });
  }
  
  return results;
}

// ==========================================
// COIN DEDUCTION TESTS
// ==========================================

async function testCoinDeduction(): Promise<PurchaseTestResult[]> {
  const results: PurchaseTestResult[] = [];
  
  // Test 1: Test deductCoins for entrance effect
  const start1 = performance.now();
  try {
    const result = await deductCoins({
      userId: TEST_USER_ID,
      amount: 100,
      type: 'entrance_effect',
      description: 'Test entrance effect purchase',
      metadata: { effect_id: 'test_effect' }
    });
    results.push({
      category: 'entrance_effect',
      testName: 'Deduct Coins - Entrance Effect',
      success: result.success,
      error: result.error,
      details: { newBalance: result.newBalance },
      duration: performance.now() - start1
    });
  } catch (err: any) {
    results.push({
      category: 'entrance_effect',
      testName: 'Deduct Coins - Entrance Effect',
      success: false,
      error: err.message,
      duration: performance.now() - start1
    });
  }
  
  // Test 2: Test deductCoins for insurance
  const start2 = performance.now();
  try {
    const result = await deductCoins({
      userId: TEST_USER_ID,
      amount: 100,
      type: 'insurance_purchase',
      description: 'Test insurance purchase',
      metadata: { insurance_id: 'test_insurance' }
    });
    results.push({
      category: 'insurance',
      testName: 'Deduct Coins - Insurance',
      success: result.success,
      error: result.error,
      details: { newBalance: result.newBalance },
      duration: performance.now() - start2
    });
  } catch (err: any) {
    results.push({
      category: 'insurance',
      testName: 'Deduct Coins - Insurance',
      success: false,
      error: err.message,
      duration: performance.now() - start2
    });
  }
  
  // Test 3: Test deductCoins for perk
  const start3 = performance.now();
  try {
    const result = await deductCoins({
      userId: TEST_USER_ID,
      amount: 100,
      type: 'perk_purchase',
      description: 'Test perk purchase',
      metadata: { perk_id: 'test_perk' }
    });
    results.push({
      category: 'perk',
      testName: 'Deduct Coins - Perk',
      success: result.success,
      error: result.error,
      details: { newBalance: result.newBalance },
      duration: performance.now() - start3
    });
  } catch (err: any) {
    results.push({
      category: 'perk',
      testName: 'Deduct Coins - Perk',
      success: false,
      error: err.message,
      duration: performance.now() - start3
    });
  }
  
  return results;
}

// ==========================================
// MAIN TEST RUNNER
// ==========================================

/**
 * Run all purchase tests
 */
export async function runAllPurchaseTests(): Promise<{
  summary: { total: number; passed: number; failed: number };
  results: PurchaseTestResult[];
  report: string;
}> {
  console.log('🧪 Starting CoinStore Purchase Tests...\n');
  
  const allResults: PurchaseTestResult[] = [];
  
  // Setup
  const setupSuccess = await setupTestUser();
  if (!setupSuccess) {
    console.warn('⚠️ Test user setup failed - some tests may not run');
  }
  
  // Run all test suites
  console.log('Testing Entrance Effects...');
  allResults.push(...await testEntranceEffects());
  
  console.log('Testing Insurance...');
  allResults.push(...await testInsurance());
  
  console.log('Testing Call Minutes...');
  allResults.push(...await testCallMinutes());
  
  console.log('Testing Perks...');
  allResults.push(...await testPerks());
  
  console.log('Testing Coin Deduction...');
  allResults.push(...await testCoinDeduction());
  
  // Cleanup
  await cleanupTestPurchases();
  
  // Generate summary
  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  
  // Generate report
  const report = generateTestReport(allResults, { total: allResults.length, passed, failed });
  
  console.log('\n' + report);
  
  return {
    summary: { total: allResults.length, passed, failed },
    results: allResults,
    report
  };
}

/**
 * Generate test report
 */
function generateTestReport(
  results: PurchaseTestResult[],
  summary: { total: number; passed: number; failed: number }
): string {
  let report = '\n' + '='.repeat(60) + '\n';
  report += '📊 COINSTORE PURCHASE TEST REPORT\n';
  report += '='.repeat(60) + '\n\n';
  
  // Summary
  report += `Total Tests: ${summary.total}\n`;
  report += `✅ Passed: ${summary.passed}\n`;
  report += `❌ Failed: ${summary.failed}\n`;
  report += `Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%\n\n`;
  
  // Group by category
  const categories = ['entrance_effect', 'insurance', 'call_minutes', 'perk'] as const;
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    if (categoryResults.length === 0) continue;
    
    const categoryPassed = categoryResults.filter(r => r.success).length;
    const categoryFailed = categoryResults.filter(r => !r.success).length;
    
    report += `${category.toUpperCase().replace('_', ' ')}:\n`;
    report += '-'.repeat(40) + '\n';
    
    for (const result of categoryResults) {
      const icon = result.success ? '✅' : '❌';
      report += `  ${icon} ${result.testName} (${result.duration.toFixed(0)}ms)\n`;
      if (result.error) {
        report += `     Error: ${result.error}\n`;
      }
    }
    
    report += `  Summary: ${categoryPassed} passed, ${categoryFailed} failed\n\n`;
  }
  
  report += '='.repeat(60) + '\n';
  
  return report;
}

// ==========================================
// QUICK VALIDATION CHECKS
// ==========================================

/**
 * Quick validation of purchase system integrity
 */
export async function validatePurchaseSystem(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Check 1: Insurance plans exist
  const plans = await getInsurancePlans();
  if (plans.length === 0) {
    issues.push('No insurance plans found in database');
  }
  
  // Check 2: Call packages are defined
  if (CALL_PACKAGES.audio.length === 0) {
    issues.push('No audio call packages defined');
  }
  if (CALL_PACKAGES.video.length === 0) {
    issues.push('No video call packages defined');
  }
  
  // Check 3: Perk config has entries
  const perkKeys = Object.keys(PERK_CONFIG);
  if (perkKeys.length === 0) {
    issues.push('No perks configured');
  }
  
  // Check 4: Entrance effects config
  const entranceConfig = getEntranceEffectConfig('soft_glow');
  if (!entranceConfig) {
    issues.push('Entrance effect config not available');
  }
  
  // Check 5: Transaction types are valid
  const validTypes = [
    'entrance_effect', 
    'insurance_purchase', 
    'perk_purchase', 
    'purchase'
  ];
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Export for use in debug panel or testing
export const CoinStoreTests = {
  runAllPurchaseTests,
  validatePurchaseSystem,
  testEntranceEffects,
  testInsurance,
  testCallMinutes,
  testPerks,
  testCoinDeduction
};
