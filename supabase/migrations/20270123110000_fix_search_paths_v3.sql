-- Fix function search paths to secure them
-- Generated from user request

ALTER FUNCTION public.activate_entrance_effect(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.activate_store_item(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.apply_troll_pass_bundle(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_visa_redemption(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_visa_redemption(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.buy_car_insurance(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.buy_car_insurance(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_secretary_assignment(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_active_items() SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_starter_vehicle(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user_credit() SET search_path = public, pg_temp;
ALTER FUNCTION public.purchase_car_v2(uuid, jsonb, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.troll_bank_escrow_coins(uuid, bigint, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.troll_bank_spend_coins_secure(uuid, bigint, text, text, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.troll_bank_spend_coins_secure(uuid, integer, text, text, text, jsonb) SET search_path = public, pg_temp;
