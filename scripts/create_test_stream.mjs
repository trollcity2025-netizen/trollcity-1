
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const userId = '461a2b0a-2cec-4579-97f4-5841e95330b9'; // starqueen
  const streamId = '11111111-1111-4111-8111-111111111111'; // Fixed ID for easy access

  const streamData = {
    id: streamId,
    broadcaster_id: userId,
    user_id: userId,
    owner_id: userId,
    streamer_id: userId,
    host_user_id: userId,
    title: 'Test Bunny Stream',
    status: 'live',
    is_live: true,
    hls_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    hls_path: '/test/bunny.m3u8',
    started_at: new Date().toISOString(),
    room_name: 'test-bunny-stream',
    viewer_count: 10,
    thumbnail_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/1200px-Big_buck_bunny_poster_big.jpg',
    box_count: 1,
    seat_price: 0,
    are_seats_locked: false,
    pricing_type: 'free',
    layout_mode: 'standard',
    category: 'Just Chatting',
    description: 'This is a test stream to verify HLS playback.'
  };

  console.log('Upserting test stream...');
  const { data, error } = await supabase
    .from('streams')
    .upsert(streamData)
    .select();

  if (error) {
    console.error('Error creating stream:', error);
  } else {
    console.log('Stream created successfully!');
    console.log('Stream ID:', data[0].id);
    console.log('HLS URL:', data[0].hls_url);
    console.log('Broadcaster:', userId);
  }
}

main();
