
UPDATE public.properties
SET
    is_repossessed = FALSE,
    repossessed_at = NULL,
    repossessed_by = NULL,
    repossession_reason = NULL;

UPDATE public.user_vehicles
SET
    is_repossessed = FALSE,
    repossessed_at = NULL,
    repossessed_by = NULL,
    repossession_reason = NULL;

TRUNCATE TABLE public.loan_default_summons RESTART IDENTITY CASCADE;

DELETE FROM public.admin_action_logs
WHERE action_type IN ('property_repossession', 'vehicle_repossession', 'credit_card_repo');
