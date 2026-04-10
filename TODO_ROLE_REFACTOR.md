# ROLE SYSTEM REFACTOR TODO

## Current Problem
Currently there are **4 separate role tracking systems** in use simultaneously:
1.  `role` column (text: admin, secretary, lead_troll_officer, troll_officer, user)
2.  `is_admin` boolean
3.  `is_troll_officer` boolean
4.  `is_lead_officer` boolean

This causes:
- Conflicting permissions
- Inconsistent state when roles are updated
- UI showing different results than backend
- Permission bugs
- Duplicate logic across 150+ files

---

## Scope of Work
### ✅ Total files to update: **181 files**

---

### 🔹 Backend Database & RPC
1.  **37 PostgreSQL RPC functions** that check roles
2.  **42 Row Level Security (RLS) policies**
3.  **29 Supabase Edge Functions**
4.  Drop 4 boolean columns after migration:
    - `is_admin`
    - `is_troll_officer`
    - `is_lead_officer`
    - `is_lead_troll_officer`

---

### 🔹 Frontend
1.  **73 frontend components/pages** that check admin/officer status
2.  Update `useAuthStore` to only check `role` column
3.  Remove all references to boolean flags
4.  Standardize permission helper functions

---

### 🔹 Migration Plan
**Phase 1:** Create synchronization trigger that keeps booleans in sync with `role` column  
**Phase 2:** Update all backend functions one by one to only read `role`  
**Phase 3:** Update all frontend components one by one  
**Phase 4:** Remove trigger and drop boolean columns permanently

---

### ⏱️ Estimated Time
**4 - 6 hours minimum** to complete fully

### 🎯 Result
Single source of truth for all role checks. Eliminates all permission bugs permanently.
