import React from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAvatar } from '../lib/hooks/useAvatar'
import type { AvatarConfig } from '../lib/hooks/useAvatar'
import { updateUserAvatarConfig } from '../lib/purchases'
import CropPhotoModal from '../components/CropPhotoModal'
import { KeyRound } from 'lucide-react'
import { setResetPin } from '@/services/passwordManager'
import { trollCityTheme } from '../styles/trollCityTheme'

const ProfileSetup = () => {
  const navigate = useNavigate()
  const { user, profile, setProfile } = useAuthStore()
  const { config: avatarConfig, setConfig: setAvatarConfig } = useAvatar()

  // Ensure loading is false when component mounts
  React.useEffect(() => {
    const authState = useAuthStore.getState()
    if (authState.isLoading) {
      authState.setLoading(false)
    }
  }, [])

  const suggestedUsername = React.useMemo(() => {
    if (profile?.username) return profile.username
    if (user?.id) {
      // Generate username from user ID instead of email
      return `user${user.id.substring(0, 8)}`
    }
    return ''
  }, [user?.id, profile?.username])

  const [username, setUsername] = React.useState(profile?.username || suggestedUsername)
  const [fullName, setFullName] = React.useState((profile as any)?.full_name || '')
  const [bio, setBio] = React.useState(profile?.bio || '')
  const [gender, setGender] = React.useState((profile as any)?.gender || '')
  const [messageCost, setMessageCost] = React.useState((profile as any)?.message_cost || 0)
  const [viewCost, setViewCost] = React.useState((profile as any)?.profile_view_cost || 0)
  const [loading, setLoading] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState('')
  const [bannerUrl, setBannerUrl] = React.useState(profile?.banner_url || '')
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url || '')
  const [pin, setPin] = React.useState('')
  const [savingPin, setSavingPin] = React.useState(false)
  const [coverCropModalOpen, setCoverCropModalOpen] = React.useState(false)
  const [coverCropFile, setCoverCropFile] = React.useState<File | null>(null)

  const handleUsernameChange = (value: string) => {
    // Allow letters, numbers, and underscores
    const valid = value.replace(/[^a-zA-Z0-9_]/g, '')
    setUsername(valid)
    
    if (value !== valid) {
      setUsernameError('Username can only contain letters, numbers, and underscores')
    } else {
      setUsernameError('')
    }
  }

  React.useEffect(() => {
    if (!username && suggestedUsername) {
      setUsername(suggestedUsername)
    }
  }, [suggestedUsername, username])

  // Load initial banner and profile picture from profile on mount
  React.useEffect(() => {
    if (profile?.banner_url) {
      console.log('Initial banner URL:', profile.banner_url)
      setBannerUrl(profile.banner_url)
    }
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url)
    }
    if ((profile as any)?.gender) {
      console.log('Initial gender:', (profile as any).gender)
      setGender((profile as any).gender)
    }
    if ((profile as any)?.full_name) {
      setFullName((profile as any).full_name)
    }
    if (profile?.bio) {
      setBio(profile.bio)
    }
    if ((profile as any)?.message_cost) {
      setMessageCost((profile as any).message_cost)
    }
    if ((profile as any)?.profile_view_cost) {
      setViewCost((profile as any).profile_view_cost)
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!user) {
      toast.error('Please sign in')
      return
    }
    const uname = username.trim()
    if (!uname) {
      toast.error('Username is required')
      return
    }
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(uname)) {
      toast.error('Use 2–20 letters, numbers, or underscores')
      return
    }
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    if (!gender) {
      toast.error('Gender is required')
      return
    }
    setLoading(true)
    try {
      if (profile?.username !== uname) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', uname)
          .neq('id', user.id)
          .maybeSingle()
        if (existing) {
          toast.error('Username is taken')
          setLoading(false)
          return
        }
      }
      const now = new Date().toISOString()
      const { data: updatedRows, error } = await supabase
        .from('user_profiles')
        .update({ 
          username: uname, 
          full_name: fullName.trim(),
          bio: bio || null, 
          gender,
          message_cost: messageCost,
          profile_view_cost: viewCost,
          updated_at: now 
        })
        .eq('id', user.id)
        .select('*')
      
      if (error) throw error
      
      const updatedProfile = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows
      let nextProfile = updatedProfile as any

      if (updatedProfile) {
        setProfile(updatedProfile as any)
        try {
          localStorage.setItem(
            `tc-profile-${user.id}`,
            JSON.stringify({ data: updatedProfile, timestamp: Date.now() })
          )
        } catch {}
      } else {
        const { data: fallback } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (fallback) {
          nextProfile = fallback as any
          setProfile(fallback as any)
        }
      }

      // Explicitly refresh the profile in the auth store
      await useAuthStore.getState().refreshProfile?.()

      toast.success('Profile saved')

      if (nextProfile && user) {
        const g = (nextProfile as any).gender as string | null
        const isFemale = g === 'female'
        const baseAvatar: AvatarConfig = {
          skinTone: isFemale ? 'light' : 'medium',
          hairStyle: isFemale ? 'long' : 'short',
          hairColor: isFemale ? 'blonde' : 'brown',
          outfit: isFemale ? 'casual' : 'street',
          accessory: 'none',
          useAsProfilePicture: avatarConfig.useAsProfilePicture
        }

        setAvatarConfig(baseAvatar)

        await updateUserAvatarConfig(user.id, {
          avatar_config: baseAvatar
        })
      }

      // Navigate to profile page to see changes
      navigate(`/profile/${nextProfile?.username || uname}`)
    } catch (err: any) {
      console.error('Profile save error:', err)
      toast.error(err?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
      // Ensure store loading state is also reset
      const authState = useAuthStore.getState()
      authState.setLoading(false)
    }
  }

  const avatarInputRef = React.useRef<HTMLInputElement>(null)
  const coverInputRef = React.useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingAvatar(true)
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
      
      const ext = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const filename = `${user.id}-${timestamp}.${ext}`
      
      // Try 'avatars' bucket first (standard)
      let uploadedUrl: string | null = null
      let uploadError = null
      
      // Attempt 1: 'avatars' bucket
      try {
        const { error } = await supabase.storage
          .from('avatars')
          .upload(filename, file, { cacheControl: '3600', upsert: true })
        
        if (!error) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
          uploadedUrl = data.publicUrl
        } else {
          console.warn('Upload to avatars bucket failed:', error)
          uploadError = error
        }
      } catch (err) {
        console.warn('Exception uploading to avatars bucket:', err)
      }

      // Attempt 2: 'troll-city-assets' (fallback)
      if (!uploadedUrl) {
        try {
          const fallbackPath = `avatars/${filename}`
          const { error } = await supabase.storage
            .from('troll-city-assets')
            .upload(fallbackPath, file, { cacheControl: '3600', upsert: true })
          
          if (!error) {
            const { data } = supabase.storage.from('troll-city-assets').getPublicUrl(fallbackPath)
            uploadedUrl = data.publicUrl
          } else {
             console.warn('Upload to troll-city-assets bucket failed:', error)
          }
        } catch (err) {
          console.warn('Exception uploading to troll-city-assets:', err)
        }
      }

      if (!uploadedUrl) {
        throw uploadError || new Error('Failed to upload profile picture to any bucket')
      }

      // Set local avatar URL immediately for instant UI feedback
      setAvatarUrl(uploadedUrl)

      // Update database
      const { data: updatedRows, error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: uploadedUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*')
      
      if (updateErr) throw updateErr
      const updatedProfile = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows
      if (updatedProfile) {
        setProfile(updatedProfile as any)
        try {
          localStorage.setItem(
            `tc-profile-${user.id}`,
            JSON.stringify({ data: updatedProfile, timestamp: Date.now() })
          )
        } catch (err) {
          console.warn('Failed to update localStorage:', err)
        }
        useAuthStore.getState().refreshProfile?.()
      }
      
      toast.success('Profile picture uploaded successfully')
    } catch (err: any) {
      console.error('Profile picture upload error:', err)
      toast.error(err?.message || 'Failed to upload profile picture')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')

      // Open crop modal instead of uploading directly
      setCoverCropFile(file)
      setCoverCropModalOpen(true)
    } catch (err: any) {
      console.error('Cover upload error:', err)
      toast.error(err?.message || 'Failed to upload cover photo')
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  const handleCoverCrop = async (croppedFile: File) => {
    if (!user) return

    try {
      setUploadingCover(true)
      setCoverCropModalOpen(false)

      const ext = croppedFile.name.split('.').pop() || 'jpg'
      const name = `${user.id}-${Date.now()}.${ext}`

      // Try different bucket and path combinations
      const uploadAttempts = [
        { bucket: 'covers', path: name },
        { bucket: 'troll-city-assets', path: `covers/${name}` },
        { bucket: 'avatars', path: name },
        { bucket: 'public', path: name }
      ]
      
      let uploadedUrl: string | null = null
      let lastErr: any = null

      for (const attempt of uploadAttempts) {
        try {
          console.log(`Trying bucket: ${attempt.bucket}, path: ${attempt.path}`)
          
          const { error: uploadErr } = await supabase.storage
            .from(attempt.bucket)
            .upload(attempt.path, croppedFile, { cacheControl: '3600', upsert: true })

          if (uploadErr) {
            console.log(`Failed with ${attempt.bucket}:`, uploadErr.message)
            lastErr = uploadErr
            continue
          }

          const { data: urlData } = supabase.storage.from(attempt.bucket).getPublicUrl(attempt.path)
          if (urlData?.publicUrl) {
            uploadedUrl = urlData.publicUrl
            console.log(`Success with bucket ${attempt.bucket}:`, uploadedUrl)
            break
          }
        } catch (err) {
          console.log(`Error with ${attempt.bucket}:`, err)
          lastErr = err
        }
      }

      if (!uploadedUrl) {
        throw lastErr || new Error('Failed to upload cover photo (no bucket available)')
      }

      console.log('Uploaded URL:', uploadedUrl)
      console.log('User ID:', user.id)

      // Update database with clean URL (without checking profile first to avoid RLS issues)
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ banner_url: uploadedUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateErr) {
        console.error('Database update error:', updateErr)
        throw new Error(`Failed to save cover photo: ${updateErr.message}`)
      }
      
      console.log('Banner URL update completed successfully for user:', user.id)
      console.log('Updated banner_url:', uploadedUrl)
      
      // Add cache-busting parameter to force reload
      const cacheBustedUrl = `${uploadedUrl}?t=${Date.now()}`
      
      console.log('Setting banner URL with cache buster:', cacheBustedUrl)
      
      // Set local banner URL with cache-buster for instant UI feedback
      setBannerUrl(cacheBustedUrl)
      
      // Create updated profile object manually since fetch might fail due to RLS
      const updatedProfile = { 
        ...profile, 
        banner_url: uploadedUrl, 
        updated_at: new Date().toISOString() 
      }
      
      // Update global store with new profile data
      setProfile(updatedProfile as any)
        
      // Update localStorage cache
      try {
        localStorage.setItem(
          `tc-profile-${user.id}`,
          JSON.stringify({ data: updatedProfile, timestamp: Date.now() })
        )
      } catch (err) {
        console.warn('Failed to update localStorage:', err)
      }
      
      // Refresh the auth store profile
      await useAuthStore.getState().refreshProfile?.()

      // Force a small delay to ensure state updates
      setTimeout(() => {
        console.log('Current bannerUrl state:', cacheBustedUrl)
      }, 100)
      
      toast.success('Cover photo updated successfully')
    } catch (err: any) {
      console.error('Cover upload error:', err)
      toast.error(err?.message || 'Failed to upload cover photo')
    } finally {
      setUploadingCover(false)
      setCoverCropFile(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6`}>
      {/* Crop Photo Modal */}
      <CropPhotoModal
        isOpen={coverCropModalOpen}
        imageFile={coverCropFile}
        onCrop={handleCoverCrop}
        onCancel={() => {
          setCoverCropModalOpen(false)
          setCoverCropFile(null)
          if (coverInputRef.current) coverInputRef.current.value = ''
        }}
        aspectRatio={16 / 9}
        title="Crop Cover Photo"
      />

      <div className="max-w-2xl mx-auto">
        {/* Cover Photo */}
        <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900">
          {bannerUrl && bannerUrl.trim() !== '' ? (
            <img
              src={bannerUrl}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ objectFit: 'contain', objectPosition: 'center' }}
              onLoad={() => console.log('Cover loaded:', bannerUrl)}
              onError={(e) => {
                console.error('Cover image load error:', bannerUrl)
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm uppercase tracking-[0.4em]">
              Your cover photo goes here
            </div>
          )}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className={`absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} text-white hover:bg-black/60 transition`}
          >
            {uploadingCover ? 'Uploading...' : 'Change Cover Photo'}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </div>

        {/* Profile Picture */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
              alt="profile picture"
              className="w-20 h-20 rounded-full border border-[#2C2C2C] object-cover"
            />
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1 text-sm font-semibold rounded-md bg-[#7C3AED] text-white hover:bg-[#6B21A8] disabled:opacity-60"
              >
                {uploadingAvatar ? 'Updating Profile Picture...' : 'Update Profile Picture'}
              </button>
              <p className="text-xs text-gray-400">JPG/PNG up to 5MB.</p>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Profile Info */}
        <details className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C]" open>
          <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
            <span className="font-semibold">Profile Info</span>
            <span className="text-sm bg-[#7C3AED] text-white px-3 py-1 rounded">Edit</span>
          </summary>

          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm mb-2">Full Name (Required)</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm mb-2">Username (letters, numbers, and underscores)</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                />
                {usernameError && (
                  <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                )}
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm mb-2">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm mb-2">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-yellow-400">Message Cost (TC)</label>
                  <input
                    type="number"
                    min="0"
                    value={messageCost}
                    onChange={(e) => setMessageCost(Number(e.target.value))}
                    className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">Cost for users to message you (0 = Free)</p>
                </div>
                <div>
                  <label className="block text-sm mb-2 text-yellow-400">View Profile Cost (TC)</label>
                  <input
                    type="number"
                    min="0"
                    value={viewCost}
                    onChange={(e) => setViewCost(Number(e.target.value))}
                    className={`w-full px-4 py-2 rounded ${trollCityTheme.components.input} text-white focus:outline-none`}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">Cost to view your full profile (0 = Free)</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 ${trollCityTheme.gradients.button} text-white rounded`}
              >
                {loading ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          </div>
        </details>



        <details className={`${trollCityTheme.backgrounds.card} rounded-lg border ${trollCityTheme.borders.glass} mt-6`} open>
          <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
            <span className="font-semibold">Payout Settings</span>
            <span className={`text-sm ${trollCityTheme.gradients.button} text-white px-3 py-1 rounded`}>PayPal</span>
          </summary>

          <div className="px-6 pb-6 space-y-3">
            <p className="text-sm text-gray-400">
              Set the PayPal email where you want to receive your Troll City payouts.
            </p>
            <button
              type="button"
              onClick={() => navigate('/payouts/setup')}
              className={`px-4 py-2 ${trollCityTheme.gradients.button} rounded-lg font-semibold text-sm text-white`}
            >
              Open Payout Settings
            </button>
            <p className="text-xs text-gray-500">
              Payouts are sent only to your PayPal payout email. Make sure it matches your PayPal account.
            </p>
          </div>
        </details>

        <details className={`${trollCityTheme.backgrounds.card} rounded-lg border ${trollCityTheme.borders.glass} mt-6`}>
          <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
            <span className="font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              Password Reset PIN
            </span>
            <span className="text-xs text-gray-400">Optional</span>
          </summary>

          <div className="px-6 pb-6 space-y-3">
            <p className="text-xs text-gray-400">
              Set a 6-digit PIN you can use later to reset your password.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                inputMode="numeric"
                pattern="\\d*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                  setPin(v)
                }}
                placeholder="Enter 6-digit PIN"
                className="px-4 py-2 bg-[#23232b] border border-gray-600 rounded-xl text-white w-48 tracking-widest"
              />
              <button
                type="button"
                disabled={savingPin || pin.length !== 6}
                onClick={async () => {
                  if (pin.length !== 6) {
                    toast.error('PIN must be exactly 6 digits')
                    return
                  }
                  setSavingPin(true)
                  const { error } = await setResetPin(pin)
                  setSavingPin(false)
                  if (error) {
                    toast.error('Failed to save PIN')
                  } else {
                    toast.success('Password reset PIN saved')
                    setPin('')
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold disabled:opacity-50"
              >
                {savingPin ? 'Saving...' : 'Save PIN'}
              </button>
            </div>
          </div>
        </details>


          {/* 🆔 ID Verification Section */}
          <details className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] mt-6">
            <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
              <span className="font-semibold">ID Verification (Required for Account Access)</span>
              <span className="text-sm bg-red-600 text-white px-3 py-1 rounded">Required</span>
            </summary>

            <div className="px-6 pb-6 space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-300 mb-2">📋 Important Notice</h3>
                <p className="text-sm text-yellow-200 mb-3">
                  To comply with our safety policies and prevent fraud, all users must upload a valid government-issued ID before gaining full access to Troll City features.
                </p>
                <p className="text-sm text-yellow-200">
                  Your ID will be securely stored and only accessible to administrators for verification purposes.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-gray-300 mb-1">
                  Upload Government ID (Driver&apos;s License, Passport, or State ID)
                </label>
                <div className={`${trollCityTheme.components.input} border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors`}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !user) return

                      try {
                        setLoading(true)
                        const fileName = `id-${user.id}-${Date.now()}${file.name.substring(file.name.lastIndexOf('.'))}`
                        const filePath = `verification/${user.id}/${fileName}`

                        // Upload to Supabase storage
                        const { error: uploadError } = await supabase.storage
                          .from('verification_docs')
                          .upload(filePath, file, { cacheControl: '3600', upsert: false })

                        if (uploadError) throw uploadError

                        // Get public URL
                        const { data: urlData } = supabase.storage
                          .from('verification_docs')
                          .getPublicUrl(filePath)

                        // Update user profile with ID verification info
                        const { data: updated, error: profileError } = await supabase
                          .from('user_profiles')
                          .update({
                            id_document_url: urlData.publicUrl,
                            id_verification_status: 'pending',
                            id_uploaded_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', user.id)
                          .select('*')
                          .maybeSingle()

                        if (profileError && profileError.code !== 'PGRST116') throw profileError
                        if (updated) {
                          setProfile(updated as any)
                        } else {
                          const { data: fallback } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', user.id)
                            .maybeSingle()
                          if (fallback) {
                            setProfile(fallback as any)
                          }
                        }
                        try {
                          const { error: appError } = await supabase.from('applications').insert({
                            user_id: user.id,
                            type: 'id_verification',
                            status: 'pending',
                            reason: 'ID verification submitted',
                            data: {
                              id_document_url: urlData.publicUrl,
                              verification_status: 'pending'
                            }
                          })
                          if (appError) {
                            console.warn('Failed to insert id_verification application:', appError)
                          }
                        } catch (appErr) {
                          console.warn('Failed to insert id_verification application:', appErr)
                        }
                        toast.success('ID uploaded successfully! Your account will be verified by an admin within 24 hours.')
                      } catch (err: any) {
                        console.error('ID upload error:', err)
                        toast.error(err?.message || 'Failed to upload ID. Please try again.')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="hidden"
                    id="id-upload"
                  />
                  <label htmlFor="id-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xl">📄</span>
                      </div>
                      <span className="text-purple-400 font-semibold">Click to Upload ID</span>
                      <span className="text-xs text-gray-400">PDF, JPG, or PNG (max 10MB)</span>
                    </div>
                  </label>
                </div>

                {(profile as any)?.id_document_url ? (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400">✅</span>
                      <span className="text-sm text-green-300">ID uploaded successfully!</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Verification Status: <span className="font-semibold">{(profile as any).id_verification_status || 'pending'}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Your account will be reviewed by our team within 24 hours. You&apos;ll receive a notification when verified.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400 text-center">
                      No ID uploaded yet. Please upload your government-issued ID to gain full access to Troll City.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </details>
        
        {/* Fallback button for users who get stuck */}
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={() => {
              // Ensure loading is reset
              useAuthStore.getState().setLoading(false)
              navigate('/')
            }}
            className="flex-1 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded hover:from-green-700 hover:to-green-600 transition-all"
          >
            Continue to Home →
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileSetup
