import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import ProfileSetupModal from '../components/ProfileSetupModal';

const ProfileSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleProfileSubmit = async (username: string, bio?: string, gender?: string) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting profile save for user:', user.id);
      console.log('Username:', username, 'Bio:', bio);

      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Username check error:', checkError);
        toast.error('Failed to validate username. Please try again.');
        return;
      }

      if (existingUser) {
        toast.error('Username is already taken. Please choose a different one.');
        return;
      }

      console.log('Username available, updating profile...');

      // First check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing profile:', fetchError);
        toast.error('Failed to check existing profile. Please try again.');
        return;
      }

      if (!existingProfile) {
        console.log('Profile does not exist, creating new profile for user:', user.id);

        // Create new profile with welcome bonus
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            username: username.trim(),
            bio: bio?.trim() || null,
            gender: gender,
            email: user.email,
            role: 'user',
            free_coin_balance: 1000, // Welcome bonus: 1000 Tromonds
            total_earned_coins: 1000, // Track in total earnings
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('*')
          .single();

        if (createError) {
          console.error('Profile creation error:', createError);
          toast.error(`Failed to create profile: ${createError.message || 'Unknown error'}`);
          return;
        }

        console.log('Profile created successfully:', newProfile);

        // Record the welcome bonus transaction
        await supabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            type: 'welcome_bonus',
            amount: 1000,
            description: 'Welcome to Troll City! 1000 Tromonds bonus.',
            created_at: new Date().toISOString()
          });

        setProfile(newProfile);
        toast.success('Profile setup complete! You received 1000 Tromonds as a welcome bonus!');
        navigate('/');
        return;
      }

      // Update existing profile
      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update({
          username: username.trim(),
          bio: bio?.trim() || null,
          gender: gender,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        console.error('Profile update error:', error);
        console.error('Error details:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });

        // Handle specific error cases
        if (error.code === 'PGRST116') {
          toast.error('Profile not found. Please refresh the page and try again.');
        } else if (error.message) {
          toast.error(`Failed to save profile: ${error.message}`);
        } else {
          toast.error('Failed to save profile. Please try again.');
        }
        return;
      }

      if (!updatedProfile) {
        console.error('No profile data returned from update');
        toast.error('Profile saved but failed to refresh. Please refresh the page.');
        return;
      }

      console.log('Profile updated successfully:', updatedProfile);

      // Update the profile in the store
      setProfile(updatedProfile);

      toast.success('Profile setup complete!');

      // Navigate to home page
      navigate('/');

    } catch (err: any) {
      console.error('Profile setup error:', err);
      console.error('Error stack:', err?.stack);
      const errorMessage = err?.message || err?.toString() || 'Unknown error';
      toast.error(`An error occurred: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Don't allow closing the modal on profile setup page
    // Users must complete their profile
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <ProfileSetupModal
        isOpen={true}
        onSubmit={handleProfileSubmit}
        loading={loading}
        onClose={handleClose}
      />
    </div>
  );
};

export default ProfileSetupPage;