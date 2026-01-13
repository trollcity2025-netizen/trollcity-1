import React from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const ProfileSetup = () => {
  const navigate = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

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
  const [loading, setLoading] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState('')

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
      const { data: updated, error } = await supabase
        .from('user_profiles')
        .update({ 
          username: uname, 
          full_name: fullName.trim(),
          bio: bio || null, 
          updated_at: now 
        })
        .eq('id', user.id)
        .select('*')
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      
      if (updated) {
        setProfile(updated as any)
        try {
          localStorage.setItem(
            `tc-profile-${user.id}`,
            JSON.stringify({ data: updated, timestamp: Date.now() })
                        )
        } catch {}
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
      toast.success('Profile saved')
      navigate('/')
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
      const ext = file.name.split('.').pop()
      const name = `${user.id}-${Date.now()}.${ext}`
      const path = `avatars/${name}`
      // Try multiple bucket names
      let bucketName = 'troll-city-assets'
      let uploadErr = null
      let publicUrl = null
      
      // Try troll-city-assets first
      const uploadResult = await supabase.storage
        .from(bucketName)
        .upload(path, file, { cacheControl: '3600', upsert: false })
      uploadErr = uploadResult.error
      
      // If that fails, try avatars bucket
      if (uploadErr) {
        bucketName = 'avatars'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      // If that fails, try public bucket
      if (uploadErr) {
        bucketName = 'public'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      if (uploadErr) throw uploadErr
      
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path)
      publicUrl = urlData.publicUrl

      const { data: updated, error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*')
        .maybeSingle()
      
      if (updateErr && updateErr.code !== 'PGRST116') throw updateErr
      if (!updated) {
        const { data: fallback } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (fallback) {
          setProfile(fallback as any)
        }
      } else {
        setProfile(updated as any)
      }
      
      toast.success('Avatar uploaded')
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      toast.error(err?.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const uploadBuckets = ['covers', 'troll-city-assets', 'avatars', 'public']
    const uploadPath = `covers/${user.id}-${Date.now()}${file.name.substring(file.name.lastIndexOf('.'))}`

    const tryUpload = async () => {
      for (const bucket of uploadBuckets) {
        const result = await supabase.storage
          .from(bucket)
          .upload(uploadPath, file, { cacheControl: '3600', upsert: false })
        if (!result.error) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
          return urlData.publicUrl
        }
      }
      throw new Error('Failed to upload cover photo')
    }

    try {
      setUploadingCover(true)
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')

      const publicUrl = await tryUpload()

      const { data: updated, error: updateErr } = await supabase
        .from('user_profiles')
        .update({ banner_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*')
        .maybeSingle()

      if (updateErr && updateErr.code !== 'PGRST116') throw updateErr
      if (!updated) {
        const { data: fallback } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (fallback) {
          setProfile(fallback as any)
        }
      } else {
        setProfile(updated as any)
      }

      toast.success('Cover photo updated')
    } catch (err: any) {
      console.error('Cover upload error:', err)
      toast.error(err?.message || 'Failed to upload cover photo')
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Cover Photo */}
        <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900">
          {profile?.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Cover"
              className="w-full h-full object-cover"
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
            className="absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full bg-black/50 text-white border border-white/20 hover:bg-black/60 transition"
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

        {/* Avatar & Display */}
        <div className="flex items-center gap-4 mb-6">
          <img
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt="avatar"
            className="w-20 h-20 rounded-full border border-[#2C2C2C] object-cover"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
          >
            {uploadingAvatar ? 'Uploading…' : 'Change Avatar'}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
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
                  className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
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
                  className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
                />
                {usernameError && (
                  <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                )}
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm mb-2">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
                  rows={4}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
              >
                {loading ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
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
                  Upload Government ID (Driver's License, Passport, or State ID)
                </label>
                <div className="bg-[#23232b] border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors">
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
                              selfie_url: selfieUrl.publicUrl,
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
                      Your account will be reviewed by our team within 24 hours. You'll receive a notification when verified.
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
