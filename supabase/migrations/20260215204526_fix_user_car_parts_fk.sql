ALTER TABLE public.user_car_parts DROP CONSTRAINT user_car_parts_user_car_id_fkey;

ALTER TABLE public.user_car_parts ADD CONSTRAINT user_car_parts_user_car_id_ffkey
FOREIGN KEY (user_car_id) REFERENCES public.user_vehicles(id) ON DELETE CASCADE;