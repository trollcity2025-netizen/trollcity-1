-- Function to update user stream hours when stream ends
CREATE OR REPLACE FUNCTION public.update_user_stream_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  duration_hours NUMERIC;
BEGIN
  -- Only process when stream status changes to 'ended' or 'completed'
  IF NEW.status IN ('ended', 'completed') AND OLD.status NOT IN ('ended', 'completed') THEN
    -- Calculate duration in hours
    duration_hours := EXTRACT(EPOCH FROM (NEW.updated_date - NEW.created_date)) / 3600.0;
    
    -- Update user's total stream hours
    UPDATE public.profiles
    SET total_stream_hours = COALESCE(total_stream_hours, 0) + duration_hours,
        last_stream_end = NEW.updated_date
    WHERE id = NEW.streamer_id;
    
    -- Log the stream completion
    INSERT INTO public.stream_logs (stream_id, user_id, duration_hours, ended_at)
    VALUES (NEW.id, NEW.streamer_id, duration_hours, NEW.updated_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stream hours tracking
CREATE TRIGGER trigger_update_stream_hours
AFTER UPDATE ON public.streams
FOR EACH ROW
EXECUTE FUNCTION public.update_user_stream_hours();

-- Create stream logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.stream_logs (
  id SERIAL PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_hours NUMERIC NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);