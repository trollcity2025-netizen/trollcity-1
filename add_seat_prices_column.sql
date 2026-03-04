-- Add seat_prices column to streams table for per-box pricing
-- This allows broadcasters to set different prices for each seat/box

-- Add the column as an array of integers (prices for each seat index)
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS seat_prices integer[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN streams.seat_prices IS 'Array of prices for each seat/box. Index 0 = host (usually 0/free), index 1+ = guest seats. NULL means use seat_price for all seats.';

-- Update existing streams to have NULL (will fall back to seat_price)
UPDATE streams SET seat_prices = NULL WHERE seat_prices IS NULL;

-- Add index for faster queries on seat_prices
CREATE INDEX IF NOT EXISTS idx_streams_seat_prices ON streams USING GIN(seat_prices) WHERE seat_prices IS NOT NULL;

-- Create or replace function to get seat price (handles per-box pricing)
CREATE OR REPLACE FUNCTION get_seat_price(p_stream_id uuid, p_seat_index integer)
RETURNS integer AS $$
DECLARE
    v_seat_prices integer[];
    v_default_price integer;
    v_price integer;
BEGIN
    -- Get stream pricing info
    SELECT seat_prices, seat_price 
    INTO v_seat_prices, v_default_price
    FROM streams 
    WHERE id = p_stream_id;
    
    -- If per-box pricing is set and seat index exists in array, use that price
    IF v_seat_prices IS NOT NULL AND array_length(v_seat_prices, 1) > p_seat_index THEN
        v_price := v_seat_prices[p_seat_index + 1]; -- PostgreSQL arrays are 1-indexed
    ELSE
        -- Fall back to default seat price
        v_price := COALESCE(v_default_price, 0);
    END IF;
    
    -- Host seat (index 0) is always free
    IF p_seat_index = 0 THEN
        v_price := 0;
    END IF;
    
    RETURN v_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;