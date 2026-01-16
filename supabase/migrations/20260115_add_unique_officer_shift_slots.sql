-- Ensure officer shift slots cannot be duplicated for the same officer and time window
-- Addresses ON CONFLICT errors (42P10) when upserting shift slots

ALTER TABLE public.officer_shift_slots
ADD CONSTRAINT officer_shift_slots_unique_slot
UNIQUE (officer_id, shift_date, shift_start_time, shift_end_time);
