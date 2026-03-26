import React, { useState, useEffect, useCallback } from 'react';
import { CityAd, AdPlacement, CampaignType, AD_PLACEMENTS } from '../../../types/cityAds';
import { supabase } from '../../../lib/supabase';
import { uploadCityAdImage, deleteCityAdImage } from '../../../lib/uploadCityAdImage';
import { toast } from 'sonner';

interface CityAdsManagerProps {}

export default function CityAdsManager() {
  const [ads, setAds] = useState<CityAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAd, setEditingAd] = useState<CityAd | null>(null);
  const [formData, setFormData] = useState<Partial<CityAd>>({});
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [placementFilter, setPlacementFilter] = useState<AdPlacement | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch all ads with filters
  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('city_ads').select('*').order('created_at', { ascending: false });

      // Apply placement filter
      if (placementFilter) {
        query = query.eq('placement', placementFilter);
      }

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAds(data || []);
    } catch (e) {
      console.error('Failed to fetch ads:', e);
      toast.error('Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, [placementFilter, statusFilter]);

  // Initialize form data
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      image_url: '',
      cta_text: '',
      cta_link: '',
      placement: 'left_sidebar_screensaver',
      is_active: true,
      start_at: '',
      end_at: '',
      priority: 0,
      display_order: 0,
      label: 'Troll City Promo',
      campaign_type: undefined,
      background_style: undefined
    });
    setEditingAd(null);
    setPreviewUrl(null);
  };

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Compress image
      const compressedFile = await new Promise<Blob>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scale = MAX_WIDTH / img.width;
            const width = img.width * scale;
            const height = img.height * scale;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
              }, 'image/jpeg', 0.8);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      // Upload to storage
      const result = await uploadCityAdImage(compressedFile, user.id);
      if (result.success && result.url) {
        setFormData(prev => ({ ...prev, image_url: result.url }));
        setPreviewUrl(result.url);
        toast.success('Image uploaded successfully');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!formData.title || !formData.image_url || !formData.placement) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Clean up form data - convert empty strings to null for timestamp fields
      const cleanedData = {
        ...formData,
        start_at: formData.start_at || null,
        end_at: formData.end_at || null,
        subtitle: formData.subtitle || null,
        description: formData.description || null,
        cta_text: formData.cta_text || null,
        cta_link: formData.cta_link || null,
        label: formData.label || null,
        background_style: formData.background_style || null
      };

      let result;
      if (editingAd?.id) {
        // Update existing ad
        result = await supabase
          .from('city_ads')
          .update({
            ...cleanedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAd.id);
      } else {
        // Create new ad
        result = await supabase
          .from('city_ads')
          .insert({
            ...cleanedData,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      if (result.error) throw result.error;

      toast.success(editingAd ? 'Ad updated successfully' : 'Ad created successfully');
      resetForm();
      await fetchAds();
    } catch (error: any) {
      console.error('Form submit error:', error);
      toast.error(error.message || 'Failed to save ad');
    }
  };

  // Handle edit ad
  const handleEditAd = (ad: CityAd) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      subtitle: ad.subtitle || '',
      description: ad.description || '',
      image_url: ad.image_url,
      cta_text: ad.cta_text || '',
      cta_link: ad.cta_link || '',
      placement: ad.placement,
      is_active: ad.is_active,
      start_at: ad.start_at || '',
      end_at: ad.end_at || '',
      priority: ad.priority,
      display_order: ad.display_order,
      label: ad.label || 'Troll City Promo',
      campaign_type: ad.campaign_type as CampaignType | undefined,
      background_style: ad.background_style
    });
    setPreviewUrl(ad.image_url);
  };

  // Handle delete ad
  const handleDeleteAd = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this ad?')) return;
    
    try {
      // Delete image from storage if exists
      const adToDelete = ads.find(a => a.id === id);
      if (adToDelete?.image_url) {
        await deleteCityAdImage(adToDelete.image_url);
      }

      // Delete from database
      const { error } = await supabase
        .from('city_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Ad deleted successfully');
      await fetchAds();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete ad');
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (ad: CityAd) => {
    try {
      const { error } = await supabase
        .from('city_ads')
        .update({ 
          is_active: !ad.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', ad.id);

      if (error) throw error;

      toast.success(`Ad ${ad.is_active ? 'deactivated' : 'activated'} successfully`);
      await fetchAds();
    } catch (error: any) {
      console.error('Toggle active error:', error);
      toast.error(error.message || 'Failed to update ad status');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse h-12 w-12 rounded-full bg-purple-500/50 inline-block mb-4"></div>
        <p className="text-slate-400">Loading ads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold text-white">
          Promo Ads Manager
        </h2>
        <button 
          onClick={() => {
            resetForm();
          }}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          New Ad
        </button>
      </div>

      {/* Form */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title*</label>
              <input
                type="text"
                name="title"
                value={formData.title || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subtitle</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Image*</label>
              <p className="text-xs text-slate-500 mb-2">
                {(formData.placement || 'left_sidebar_screensaver') === 'home_horizontal_banner'
                  ? 'Recommended: 1200x150px (horizontal banner)'
                  : (formData.placement || 'left_sidebar_screensaver') === 'right_panel_featured'
                  ? 'Recommended: 1200x500px (featured card)'
                  : 'Recommended: 400x600px (sidebar card)'}
              </p>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-slate-400"
                />
                {uploading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-pulse h-4 w-4 rounded-full bg-purple-500"></div>
                    <span className="text-xs text-purple-400">Uploading...</span>
                  </div>
                )}
                {previewUrl && (
                  <div className="mt-2">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-w-xs rounded border border-slate-700"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Placement */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Placement*</label>
              <select
                name="placement"
                value={formData.placement || 'left_sidebar_screensaver'}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
              >
                {AD_PLACEMENTS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Label</label>
              <input
                type="text"
                name="label"
                value={formData.label || 'Troll City Promo'}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                list="label-options"
              />
              <datalist id="label-options">
                {['Troll City Promo', 'Special Offer', 'Featured', 'Limited Time', 'New', 'Exclusive'].map(label => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>

            {/* Campaign Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Campaign Type</label>
              <select
                name="campaign_type"
                value={formData.campaign_type || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="">None</option>
                {[
                  { value: 'troll_coins', label: 'Troll Coins Special' },
                  { value: 'trollmonds', label: 'Trollmonds Bundle' },
                  { value: 'go_live', label: 'Go Live Promotion' },
                  { value: 'event', label: 'Event' },
                  { value: 'feature', label: 'Feature Discovery' },
                  { value: 'limited_offer', label: 'Limited Offer' },
                  { value: 'announcement', label: 'Announcement' }
                ].map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CTA Text */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">CTA Button Text</label>
              <input
                type="text"
                name="cta_text"
                value={formData.cta_text || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* CTA Link */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">CTA Link URL</label>
              <input
                type="url"
                name="cta_link"
                value={formData.cta_link || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                placeholder="https://example.com"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active ?? true}
                onChange={handleFormChange}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-700 rounded"
              />
              <label className="ml-2 text-sm text-slate-300">Active</label>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                <input
                  type="datetime-local"
                  name="start_at"
                  value={formData.start_at || ''}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                <input
                  type="datetime-local"
                  name="end_at"
                  value={formData.end_at || ''}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Priority & Display Order */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                <input
                  type="number"
                  name="priority"
                  value={formData.priority || 0}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Display Order</label>
                <input
                  type="number"
                  name="display_order"
                  value={formData.display_order || 0}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                  min="0"
                />
              </div>
            </div>

            {/* Background Style (Advanced) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Background Style (CSS)</label>
              <input
                type="text"
                name="background_style"
                value={formData.background_style || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
                placeholder="linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="submit"
              disabled={uploading}
              className={`px-6 py-2 rounded-lg font-medium transition-colors 
                ${editingAd ? 'bg-purple-600 hover:bg-purple-500' : 'bg-green-600 hover:bg-green-500'}
                text-white ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {editingAd ? 'Update Ad' : 'Create Ad'}
            </button>
            {!editingAd && (
              <button 
                type="button"
                onClick={resetForm}
                className="ml-4 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

       {/* Filters */}
       <div className="mb-4">
         <div className="flex flex-wrap gap-3">
           <div>
             <label className="block text-sm font-medium text-slate-300 mb-1">Placement</label>
             <select
               value={placementFilter || ''}
               onChange={(e) => setPlacementFilter(e.target.value as AdPlacement | '')}
               className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
             >
                <option value="">All Placements</option>
                {AD_PLACEMENTS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
             </select>
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
             <select
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
               className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-purple-500 focus:ring-purple-500"
             >
               <option value="all">All Status</option>
               <option value="active">Active</option>
               <option value="inactive">Inactive</option>
             </select>
           </div>
           <div className="flex items-end">
             <button
               onClick={() => {
                 setPlacementFilter('');
                 setStatusFilter('all');
               }}
               className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
             >
               Reset Filters
             </button>
           </div>
         </div>
       </div>

       {/* Ads List */}
       <div>
         <h3 className="text-xl font-bold text-white mb-4">Current Ads</h3>
        {ads.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No ads found. Create your first ad above.</p>
        ) : (
          <div className="space-y-4">
            {ads.map(ad => (
              <div 
                key={ad.id} 
                className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-start justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-4">
                    {ad.image_url && (
                      <img 
                        src={ad.image_url} 
                        alt={ad.title} 
                        className="w-24 h-24 object-cover rounded-lg border border-slate-700"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-purple-600/80 text-white">
                          {ad.label || 'Troll City Promo'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-purple-600/80 text-white">
                          {AD_PLACEMENTS.find(p => p.value === ad.placement)?.label || ad.placement}
                        </span>
                      </div>
                      <h4 className="font-bold text-white">{ad.title}</h4>
                      {ad.subtitle && (
                        <p className="text-sm text-purple-200">{ad.subtitle}</p>
                      )}
                      {ad.description && (
                        <p className="text-sm text-slate-300 line-clamp-2">{ad.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                        <span>
                          {ad.is_active ? 
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              Active
                            </span> : 
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-red-500"></div>
                              Inactive
                            </span>
                          }
                        </span>
                        <span>
                          {ad.start_at || ad.end_at ? (
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                              Scheduled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                              Always
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                          {ad.clicks_count} clicks
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleEditAd(ad)}
                    className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(ad)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                  >
                    {ad.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteAd(ad.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}