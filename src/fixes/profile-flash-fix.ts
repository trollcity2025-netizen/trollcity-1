// Fix for profile view flash of old settings
// Add to Profile.tsx component

export const useProfileData = (userId: string | undefined, supabase: any) => {
  const [profileData, setProfileData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;

        if (mounted) {
          setProfileData(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [userId, supabase]);

  return { profileData, loading, error };
};

// In Profile.tsx, use this instead of directly using profile from store:
// const { profileData, loading: profileLoading } = useProfileData(userId, supabase);
// Only render profile content when !profileLoading && profileData

