# Troll City Loan Application Flow (Frontend → API → Supabase)

## 1. Frontend Request

- **Endpoint:** `/bank-apply` (Edge Function)
- **HTTP Method:** `POST`
- **Request Headers:**
  - `Content-Type: application/json`
  - `apikey: <VITE_SUPABASE_ANON_KEY>`
  - `Authorization: Bearer <access_token>`
  - `x-client-info: trollcity-web`
- **Request Body:**
  ```json
  {
    "amount": <number>
  }
  ```
- **user_id:** Not sent from frontend; derived from JWT on backend.

---

## 2. Authentication

- **Token Retrieval:**
  - Always uses `supabase.auth.getSession()` (fresh, not cached)
  - Refreshes if token is missing/expiring
- **Token Usage:**
  - `Authorization: Bearer <access_token>`
  - Never uses anon key for this endpoint
- **Token Validation:**
  - If token is missing/expired, request is not sent

---

## 3. Backend / Edge Function (`supabase/functions/bank-apply/index.ts`)

- **CORS:** Handles preflight
- **Auth:**
  - Reads `Authorization` header
  - If missing, returns `401 Unauthorized`
  - Uses token to create Supabase client
  - Calls `supabaseClient.auth.getUser()`
  - If user not found, returns `401 Unauthorized`
- **User ID:**
  - Derived from JWT (`supabaseClient.auth.getUser()`)
  - For service role, can be sent in body
- **Loan Logic:**
  - Calls RPC: `troll_bank_apply_for_loan(p_user_id, p_requested_coins)`
  - Returns error if RPC fails

---

## 4. Supabase / Database

- **RPC:** `troll_bank_apply_for_loan(p_user_id uuid, p_requested_coins int)`
- **Parameter Mapping:**
  - `p_user_id`: from JWT
  - `p_requested_coins`: from request body
- **RLS:** Not shown, but function is called as authenticated user
- **Function Signature:** Matches request

---

## 5. Output Examples

- **Request Payload:**
  ```json
  {
    "amount": 1000
  }
  ```
- **Request Headers:**
  ```
  Authorization: Bearer <access_token>
  apikey: <VITE_SUPABASE_ANON_KEY>
  Content-Type: application/json
  x-client-info: trollcity-web
  ```
- **Unauthorized Code Path:**
  ```typescript
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }
  ...
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders });
  }
  ```

---

**Summary:**
- Only `amount` and the user's access token are sent from the frontend.
- The backend derives the user from the token and calls the loan RPC.
- 401 Unauthorized is returned if the token is missing, invalid, or expired, or if the user cannot be resolved from the token.
