// Helper utility for HLS URLs

export function getHlsUrl(streamId: string): string {
  // Construct HLS URL based on environment or configuration
  // This is a placeholder - adjust based on your actual CDN/Media Server setup
  const baseUrl = import.meta.env.VITE_HLS_BASE_URL || 'https://stream.trollcity.app/hls';
  return `${baseUrl}/${streamId}/index.m3u8`;
}
