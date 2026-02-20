ALTER FUNCTION purchase_coins(user_id_in uuid, amount_in integer, payment_intent_id_in text)
ALTER amount_in TYPE bigint;