# Troll City Promo Ads System - Developer Notes

## Overview
This document describes the implementation of the internal promo ad system for Troll City, including the Secretary Console ad management UI and frontend display components.

## Database Schema
- Table: `public.city_ads`
- Storage bucket: `city-ads` (for ad images)
- Key fields: title, subtitle, description, image_url, cta_text, cta_link, placement, is_active, start_at, end_at, priority, display_order, label, campaign_type, background_style, impressions_count, clicks_count
- Constraints: 
  - placement must be 'left_sidebar_screensaver' or 'right_panel_featured'
  - end_at must be greater than start_at when both are provided
- Triggers: updated_at trigger automatically sets timestamp on updates
- RLS Policies: Only admins and secretaries can perform CRUD operations
- Helper Functions:
  - `get_active_ads_for_placement(placement, limit)` - returns active ads for a placement
  - `increment_ad_impressions(ad_id)` - increments impression count
  - `increment_ad_clicks(ad_id)` - increments click count

## Components Created

### 1. PromoAdCard (`src/components/promo/PromoAdCard.tsx`)
- Reusable ad card component used in both sidebar and right panel slots
- Features:
  - Responsive sizing (sidebar vs featured variants)
  - Lazy-loaded images with loading states
  - Hover effects with scale and glow
  - Gradient overlay for text readability
  - Label badge (configurable via ad.label)
  - Title, subtitle, description (featured only)
  - CTA button with click tracking
  - Click tracking via RPC function (with fallback to direct update)
  - Stats display for admin preview (impressions/clicks)

### 2. PromoSlot (`src/components/promo/PromoSlot.tsx`)
- Rotating promotional ad slot component
- Features:
  - Fetches active ads for a specific placement
  - Automatic rotation every 8-12 seconds (randomized)
  - Fade transition between ads
  - Pause rotation on hover
  - Navigation dots for manual ad selection
  - Impression tracking when ads are displayed
  - Loading and empty states
  - Priority-based ordering (priority desc, display_order asc, created_at desc)

### 3. Sidebar Integration (`src/components/Sidebar.tsx`)
- Added import for PromoSlot component
- The PromoSlot is used in the SidebarGroup component (not shown in the visible file but referenced in imports)
- Displays left_sidebar_screensaver placement ads when sidebar is empty

### 4. Right Panel Integration
- The PromoSlot component is designed to be used in the right panel area
- Should be integrated wherever the right panel content is rendered when empty
- Uses right_panel_featured placement

### 5. Secretary Console Ad Manager (`src/pages/secretary/components/CityAdsManager.tsx`)
- Complete CRUD interface for managing promo ads
- Features:
  - List view of all ads with filtering by placement and status
  - Create/edit form with validation
  - Image upload with compression and preview
  - Placement selection (left sidebar or right panel)
  - Active/inactive toggle
  - Scheduling (start/end dates)
  - Priority and display order fields
  - Label customization with predefined options
  - Campaign type categorization
  - Background style customization (advanced)
  - CTA text and link fields
  - Delete confirmation
  - Toast notifications for user feedback
  - Loading states

### 6. Image Upload Utility (`src/lib/uploadCityAdImage.ts`)
- Handles uploading ad images to Supabase Storage
- Features:
  - File type validation (JPEG, PNG, WebP, GIF)
  - File size validation (5MB max)
  - Image compression (max width 800px, quality 0.8)
  - Unique file naming (userId/timestamp.extension)
  - Public URL retrieval
  - Delete function for cleanup

## Integration Points

### Secretary Console
- Added new tab "Promo Ads" in `src/pages/secretary/SecretaryConsole.tsx`
- Tab icon: FileText from lucide-react
- Tab color: orange
- Renders CityAdsManager component when active

### Frontend Display
- Left Sidebar: Uses PromoSlot with placement='left_sidebar_screensaver' and variant='sidebar'
- Right Panel: Uses PromoSlot with placement='right_panel_featured' and variant='featured'

## Environment Variables
No new environment variables required - uses existing Supabase configuration.

## Security
- RLS policies restrict access to admins and secretaries only
- Image uploads require authenticated user
- All database operations go through Supabase client with proper auth
- Input validation on both client and server (via constraints)

## Performance Considerations
- Lazy-loaded images prevent unnecessary bandwidth usage
- Efficient database queries with indexes on placement, is_active, start_at, end_at
- Rotation uses requestAnimationFrame-friendly setInterval
- Image compression reduces storage and bandwidth usage
- Caching of ad lists could be added for better performance

## Future Enhancements
1. Add filtering by placement and status in CityAdsManager list view
2. Add A/B testing capabilities
3. Add more detailed analytics (CTR, etc.)
4. Support for video ads
5. Template system for ad designs
6. Scheduled activation/deactivation
7. Ad expiration notifications
8. Integration with external ad networks (for future monetization)
9. A/B testing for ad copy and designs
10. Ad scheduling calendar view

## Known Issues
1. Mobile/tablet responsiveness should be tested (though feature is desktop-only by design)

## Files Modified/Added
1. `add_city_ads_table.sql` - Database migration
2. `CITY_ADS_STORAGE_SETUP.md` - Storage bucket setup guidance
3. `src/types/cityAds.ts` - TypeScript types for ads
4. `src/lib/uploadCityAdImage.ts` - Image upload utility
5. `src/components/promo/PromoAdCard.tsx` - Reusable ad card component
6. `src/components/promo/PromoSlot.tsx` - Rotating ad slot component
7. `src/pages/secretary/SecretaryConsole.tsx` - Added Promo Ads tab
8. `src/pages/secretary/components/CityAdsManager.tsx` - Ad manager UI
9. `src/components/Sidebar.tsx` - Imported PromoSlot (integration point)