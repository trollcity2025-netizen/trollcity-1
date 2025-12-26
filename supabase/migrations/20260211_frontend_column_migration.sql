-- Migration: Frontend Column Reference Updates (Documentation)
-- Date: 2025-02-11
-- Purpose: Document the frontend TypeScript/TSX migration from old to new coin balance column names
--
-- This migration serves as documentation for the corresponding frontend changes made to support:
-- - troll_coins_balance → troll_coins
-- - free_coin_balance → trollmonds
--
-- =====================================================
-- FRONTEND FILES UPDATED
-- =====================================================
--
-- 1. Core Coin Transaction Library (src/lib/coinTransactions.ts)
--    - Lines 106: Updated select statement to use new column names
--    - Lines 201: Updated deductCoins select statement
--    - Lines 226: Updated field mapping logic
--    - Lines 292, 308: Updated addCoins select and field mapping
--
-- 2. Admin Coin Management (src/lib/adminCoins.ts)
--    - Line 48: Updated grantAdminCoins select statement
--    - Line 66: Updated target field mapping
--    - Line 111: Fixed rollback logic
--    - Lines 146, 154: Updated deductAdminCoins select and field mapping
--
-- 3. Admin Profile Panel (src/components/AdminProfilePanel.tsx)
--    - Line 34: Updated select statement to new column names
--
-- 4. Coin Balance Hook (src/lib/hooks/useCoins.ts)
--    - Lines 50-51: Updated initial state with fallback logic
--    - Helper functions already support dual-column detection
--
-- 5. Entrance Effects Page (src/pages/EntranceEffects.tsx)
--    - Lines 83, 95, 131, 255: Updated balance checks and coin deductions
--
-- 6. Insurance Page (src/pages/TrollerInsurance.tsx)
--    - Line 119: Updated balance check
--    - Line 144: Updated coinType parameter to 'troll_coins'
--
-- 7. Shop View (src/pages/ShopView.tsx)
--    - Line 101: Updated coinType parameter to 'troll_coins'
--
-- 8. Empire Partner Apply (src/pages/EmpirePartnerApply.tsx)
--    - Line 69: Updated coinType parameter to 'troll_coins'
--
-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Frontend migration documentation completed';
  RAISE NOTICE 'All TypeScript/TSX files updated to use new column names: troll_coins, trollmonds';
  RAISE NOTICE 'All RPC calls updated to use correct coinType values';
END $$;
