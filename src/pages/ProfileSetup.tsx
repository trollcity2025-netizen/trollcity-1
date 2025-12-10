import React from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { recordAppEvent, recordEvent } from '../lib/progressionEngine'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const ProfileSetup = () => {
  const navigate = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

  const suggestedUsername = React.useMemo(() => {
    if (profile?.username) return profile.username
    if (user?.id) {
      // Generate username from user ID instead of email
      return `user${user.id.substring(0, 8)}`
    }
    return ''
  }, [user?.id, profile?.username])

  const [username, setUsername] = React.useState(profile?.username || suggestedUsername)
  const [bio, setBio] = React.useState(profile?.bio || '')
  const [loading, setLoading] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState('')

  const handleUsernameChange = (value: string) => {
    // Only allow letters and numbers
    const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, '')
    setUsername(alphanumeric)
    
    if (value !== alphanumeric) {
      setUsernameError('Username can only contain letters and numbers')
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
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: uname, bio: bio || null, updated_at: now })
        .eq('id', user.id)
      if (error) throw error
      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updated) {
        setProfile(updated as any)
        try {
          localStorage.setItem(
            `tc-profile-${user.id}`,
            JSON.stringify({ data: updated, timestamp: Date.now() })
          )
        } catch {}
      }
      toast.success('Profile saved')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const avatarInputRef = React.useRef<HTMLInputElement>(null)

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

      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateErr) throw updateErr

      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updated) setProfile(updated as any)
      toast.success('Avatar uploaded')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

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
                <label htmlFor="username" className="block text-sm mb-2">Username (letters and numbers only)</label>
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

        {/* 💸 Payout Information Section */}
        <details className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] mt-6" open>
          <summary className="cursor-pointer px-6 py-4 flex items-center justify-between">
            <span className="font-semibold">Payout Information (Required for Cashouts)</span>
            <span className="text-sm bg-[#7C3AED] text-white px-3 py-1 rounded">Edit</span>
          </summary>

          <div className="px-6 pb-6 space-y-4">
            <label className="block text-sm text-gray-300 mb-1">
              Select Payout Method
            </label>
            <select
              value={profile?.payout_method || ''}
              onChange={(e) => {
                const updated = { ...profile, payout_method: e.target.value };
                setProfile(updated as any);
              }}
              className="w-full bg-[#23232b] text-white p-2 rounded border border-gray-600"
            >
              <option value="">Choose one...</option>
              <option value="CashApp">CashApp (Cashtag)</option>
              <option value="PayPal">PayPal Email</option>
              <option value="Venmo">Venmo @username</option>
            </select>

            <label className="block text-sm text-gray-300 mb-1">
              Enter Your Payout Details
            </label>
            <input
              type="text"
              value={profile?.payout_details || ''}
              onChange={(e) => {
                const updated = { ...profile, payout_details: e.target.value };
                setProfile(updated as any);
              }}
              placeholder="$Cashtag, PayPal email, or Venmo handle"
              className="w-full bg-[#23232b] text-white p-2 rounded border border-gray-600"
            />

            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase
                  .from('user_profiles')
                  .update({
                    payout_method: profile?.payout_method,
                    payout_details: profile?.payout_details,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', profile?.id);

                if (error) toast.error('Failed to save payout info');
                else toast.success('Payout information saved');
              }}
              className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded"
            >
              Save Payout Info
            </button>

            <p className="text-xs text-gray-400 mt-2">
              This information is used only when you cash out coins. You only need to set it once.
            </p>
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
                        const filePath = `verification_docs/${fileName}`

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
                        const { error: profileError } = await supabase
                          .from('user_profiles')
                          .update({
                            id_document_url: urlData.publicUrl,
                            id_verification_status: 'pending',
                            id_uploaded_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', user.id)

                        if (profileError) throw profileError

                        // Update local profile
                        const { data: updated } = await supabase
                          .from('user_profiles')
                          .select('*')
                          .eq('id', user.id)
                          .single()

                        if (updated) {
                          setProfile(updated as any)
                          toast.success('ID uploaded successfully! Your account will be verified by an admin within 24 hours.')
                        }
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
        
      </div>
    </div>
  )
}

export default ProfileSetup
