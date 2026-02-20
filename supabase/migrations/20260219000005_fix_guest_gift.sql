CREATE OR REPLACE FUNCTION send_guest_gift(
    p_guest_id TEXT,
    p_receiver_id UUID,
    p_stream_id UUID,
    p_gift_id UUID,
    p_cost BIGINT, -- Changed to BIGINT
    p_quantity INT
)
RETURNS VOID AS $$
BEGIN
    -- Log the gift event in stream_messages without any coin logic
    INSERT INTO public.stream_messages (stream_id, user_id, content, type, metadata)
    SELECT 
        p_stream_id, 
        p_guest_id, 
        'GIFT_EVENT:' || g.name || ':' || p_quantity || ':' || p_cost, 
        'system',
        jsonb_build_object(
            'is_guest_gift', true,
            'gift_id', p_gift_id,
            'gift_name', g.name,
            'gift_icon', g.icon,
            'gift_cost', p_cost,
            'quantity', p_quantity,
            'guest_id', p_guest_id
        )
    FROM public.gift_items g
    WHERE g.id = p_gift_id;
END;
$$ LANGUAGE plpgsql;