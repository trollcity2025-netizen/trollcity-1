# QA Report

## 1. Executive Summary
- total accounts created by role: {"Lead Troll Officer":0,"Troll Officer":0,"Secretary":0,"Pastor":0,"TCNN":0,"Regular User":0}
- total routes visited: 0
- total actions clicked: 15
- total forms submitted: 15
- total moderation actions tested: 0
- total passed checks: 0
- total failed checks: 15

## 2. Accounts Used
- Lead Troll Officer: qa_lead_troll_officer_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Troll Officer: qa_troll_officer_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Secretary: qa_secretary_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Pastor: qa_pastor_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- TCNN: qa_tcnn_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_01_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_02_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_03_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_04_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_05_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_06_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_07_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_08_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_09_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- Regular User: qa_user_10_2026-03-25t16-36-15-668z@example.test | signup=failed | login=not_run | session=not_run
- regular user account count: 10

## 3. Role Coverage Matrix

## 4. Moderation Results Matrix
- user_01: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_02: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_03: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_04: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_05: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_06: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_07: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_08: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_09: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked
- user_10: initial=Unknown | actions=none | final=Untested | ui instant=Blocked | restrictions=Blocked | reversal=Blocked

## 5. Bugs Found
- none recorded

## 6. Supabase / Backend / Schema Issues
- Supabase / Backend / Schema | role=Lead Troll Officer | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Troll Officer | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Secretary | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Pastor | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=TCNN | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED
- Supabase / Backend / Schema | role=Regular User | operation=provision_account | error=HEAD https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?select=*&created_at=gte.2026-03-25T00%3A00%3A00.000Z -> net::ERR_ABORTED

## 7. Visibility and Authorization Findings
- pages incorrectly exposed: none
- pages incorrectly hidden: none
- actions incorrectly exposed: none
- actions incorrectly blocked: none

## 8. Blocked or Untestable Areas
- Lead Troll Officer coverage blocked because account provisioning failed.
- Troll Officer coverage blocked because account provisioning failed.
- Secretary coverage blocked because account provisioning failed.
- Pastor coverage blocked because account provisioning failed.
- TCNN coverage blocked because account provisioning failed.
- Regular User coverage blocked because account provisioning failed.
- Moderation matrix blocked because no real officer-capable account exists in the frontend run.

## 9. Recommended Fix Order
- Fix any route guards or RLS policies that prevent legitimate staff pages from loading.
- Fix moderation actions that do not update the moderator UI, target session, and backend state immediately.
- Fix schema drift between frontend expectations and deployed Supabase tables, columns, and RPCs.
- Add or expose a legitimate non-admin role assignment path if QA is expected to create staff users through the app.
- Tighten hidden/exposed navigation so regular users never see staff-only destinations.
