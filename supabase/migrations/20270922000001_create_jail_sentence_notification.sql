CREATE OR REPLACE FUNCTION public.handle_new_jail_sentence_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.global_events (type, title, icon, metadata)
    VALUES (
        'jail',
        (SELECT username FROM public.user_profiles WHERE id = NEW.user_id) || ' was just sent to jail!',
        'jail',
        jsonb_build_object('user_id', NEW.user_id, 'release_time', NEW.release_time)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_jail_sentence
    AFTER INSERT ON public.jail
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_jail_sentence_notification();
