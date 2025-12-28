import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useBackgroundProfileRefresh } from '../hooks/useBackgroundProfileRefresh'
import { toast } from 'sonner'
import { Camera, Upload, CheckCircle, XCircle, Shield, Coins, CreditCard } from 'lucide-react'

type Step = 'upload_id' | 'selfie' | 'processing' | 'result'

export default function AIVerificationPage() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const { refreshProfileInBackground } = useBackgroundProfileRefresh()
  const [step, setStep] = useState<Step>('upload_id')
  const [idPhoto, setIdPhoto] = useState<File | null>(null)
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ status: string; matchScore: number; behaviorScore: number } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'coins' | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in to get verified</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  if (profile?.is_verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-green-500/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You're Already Verified!</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg mt-4"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const handleIdPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB')
      return
    }

    setIdPhoto(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setIdPhotoUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStep('selfie')
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error('Failed to access camera. Please allow camera permissions.')
    }
  }

  const captureSelfie = async () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg')
      setSelfieUrl(dataUrl)

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      setStep('processing')
    }
  }

  const uploadPhotos = async (): Promise<{ idUrl: string; selfieUrl: string }> => {
    if (!idPhoto || !selfieUrl) throw new Error('Missing photos')

    // Upload ID photo to Supabase Storage
    const idFileName = `verification/${user.id}/id_${Date.now()}.jpg`
    const idFile = await dataURLtoFile(idPhotoUrl!, 'id.jpg')
    const { data: idData, error: idError } = await supabase.storage
      .from('verification_docs')
      .upload(idFileName, idFile, { contentType: 'image/jpeg' })

    if (idError) throw idError

    const { data: { publicUrl: idPublicUrl } } = supabase.storage
      .from('verification_docs')
      .getPublicUrl(idData.path)

    // Upload selfie
    const selfieFileName = `verification/${user.id}/selfie_${Date.now()}.jpg`
    const selfieFile = await dataURLtoFile(selfieUrl, 'selfie.jpg')
    const { data: selfieData, error: selfieError } = await supabase.storage
      .from('verification_docs')
      .upload(selfieFileName, selfieFile, { contentType: 'image/jpeg' })

    if (selfieError) throw selfieError

    const { data: { publicUrl: selfiePublicUrl } } = supabase.storage
      .from('verification_docs')
      .getPublicUrl(selfieData.path)

    return { idUrl: idPublicUrl, selfieUrl: selfiePublicUrl }
  }

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  }

  const processVerification = async () => {
    if (!idPhotoUrl || !selfieUrl) {
      toast.error('Please complete both steps')
      return
    }

    setProcessing(true)
    try {
      // Upload photos first
      const { idUrl, selfieUrl: uploadedSelfieUrl } = await uploadPhotos()

      // Call AI verification
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Not authenticated')
        return
      }

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/ai-verify-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idPhotoUrl: idUrl,
          selfieUrl: uploadedSelfieUrl
        })
      })

      if (!response.ok) {
        throw new Error('Verification failed')
      }

      const data = await response.json()
      setResult({
        status: data.status,
        matchScore: data.aiMatchScore,
        behaviorScore: data.aiBehaviorScore
      })

      if (data.autoApproved) {
        toast.success('Verification approved!')
        if (refreshProfile) await refreshProfile()
      } else if (data.status === 'in_review') {
        toast.info('Your verification is under review')
      } else {
        toast.error('Verification denied. Please try again or contact support.')
      }
    } catch (error: any) {
      console.error('Error processing verification:', error)
      toast.error(error?.message || 'Failed to process verification')
    } finally {
      setProcessing(false)
    }
  }

  const handlePayment = async (method: 'paypal' | 'coins') => {
    setPaymentMethod(method)
    
    if (method === 'coins') {
      const paidCoins = profile?.troll_coins || 0
      if (paidCoins < 500) {
        toast.error(`You need 500 paid coins. You have ${paidCoins}`)
        return
      }

      // Deduct coins and verify
      const { error } = await supabase.rpc('deduct_paid_coins', {
        p_user_id: user.id,
        p_amount: 500
      })

      if (error) {
        // Fallback direct update
        await supabase
          .from('user_profiles')
          .update({ troll_coins: (profile?.troll_coins || 0) - 500 })
          .eq('id', user.id)
      }

      await supabase.rpc('verify_user', {
        p_user_id: user.id,
        p_payment_method: 'coins',
        p_amount: 500
      })

      toast.success('Verification purchased!')
      if (refreshProfile) await refreshProfile()
      refreshProfileInBackground()
      navigate('/')
    } else {
      // PayPal flow (use existing verify-user-paypal function)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/verify-user-paypal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.approvalUrl
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">AI-Powered Verification</h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center gap-2 ${step === 'upload_id' ? 'text-purple-400' : step !== 'upload_id' ? 'text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload_id' ? 'bg-purple-600' : step !== 'upload_id' ? 'bg-green-600' : 'bg-gray-700'}`}>
              {step !== 'upload_id' ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-sm font-semibold">Upload ID</span>
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2"></div>
          <div className={`flex items-center gap-2 ${step === 'selfie' ? 'text-purple-400' : step === 'processing' || step === 'result' ? 'text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'selfie' ? 'bg-purple-600' : step === 'processing' || step === 'result' ? 'bg-green-600' : 'bg-gray-700'}`}>
              {step === 'processing' || step === 'result' ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-sm font-semibold">Selfie Match</span>
          </div>
          <div className="flex-1 h-1 bg-gray-700 mx-2"></div>
          <div className={`flex items-center gap-2 ${step === 'processing' ? 'text-purple-400' : step === 'result' ? 'text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'processing' ? 'bg-purple-600' : step === 'result' ? 'bg-green-600' : 'bg-gray-700'}`}>
              {step === 'result' ? <CheckCircle className="w-5 h-5" /> : '3'}
            </div>
            <span className="text-sm font-semibold">AI Scan</span>
          </div>
        </div>

        {/* Step 1: Upload ID */}
        {step === 'upload_id' && (
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
            <h2 className="text-xl font-semibold mb-4">Step 1: Upload Government ID</h2>
            <p className="text-sm opacity-80 mb-6">
              Upload a clear photo of your government-issued ID (driver's license, passport, etc.)
            </p>

            {idPhotoUrl ? (
              <div className="mb-4">
                <img src={idPhotoUrl} alt="ID" className="max-w-full h-64 object-contain border border-purple-600 rounded-lg" />
                <button
                  onClick={() => {
                    setIdPhoto(null)
                    setIdPhotoUrl(null)
                  }}
                  className="mt-2 text-sm text-red-400 hover:text-red-300"
                >
                  Remove and re-upload
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-purple-600 rounded-lg p-8 text-center hover:bg-purple-900/20 transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p className="font-semibold">Click to upload ID photo</p>
                  <p className="text-sm opacity-70 mt-2">JPG or PNG, max 5MB</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleIdPhotoUpload}
                  className="hidden"
                />
              </label>
            )}

            {idPhotoUrl && (
              <button
                onClick={startCamera}
                className="w-full mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
              >
                Continue to Selfie
              </button>
            )}
          </div>
        )}

        {/* Step 2: Selfie */}
        {step === 'selfie' && (
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
            <h2 className="text-xl font-semibold mb-4">Step 2: Take Live Selfie</h2>
            <p className="text-sm opacity-80 mb-6">
              Take a clear selfie that matches your ID photo
            </p>

            <div className="relative mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg border border-purple-600"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>

            <button
              onClick={captureSelfie}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Capture Selfie
            </button>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">AI Processing Your Verification</h2>
            <p className="opacity-80 mb-6">Comparing faces and analyzing your profile...</p>

            {idPhotoUrl && selfieUrl && (
              <button
                onClick={processVerification}
                disabled={processing}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Start AI Verification'}
              </button>
            )}
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
            {result.status === 'approved' ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-center mb-4">🎉 Verification Approved!</h2>
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-6">
                  <p className="text-sm mb-2">AI Match Score: <strong>{result.matchScore.toFixed(1)}%</strong></p>
                  <p className="text-sm">Behavior Score: <strong>{result.behaviorScore.toFixed(1)}%</strong></p>
                </div>
                <p className="text-center opacity-80 mb-6">
                  Complete your verification by paying $5 via PayPal or 500 paid coins
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handlePayment('paypal')}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Pay $5 via PayPal
                  </button>
                  <button
                    onClick={() => handlePayment('coins')}
                    disabled={(profile?.troll_coins || 0) < 500}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Coins className="w-5 h-5" />
                    Pay 500 Paid Coins (You have {profile?.troll_coins || 0})
                  </button>
                </div>
              </>
            ) : result.status === 'in_review' ? (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <h2 className="text-2xl font-bold mb-4">Under Review</h2>
                  <p className="opacity-80 mb-4">
                    Your verification is being reviewed by our team.
                  </p>
                  <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4 mb-6">
                    <p className="text-sm mb-2">AI Match Score: <strong>{result.matchScore.toFixed(1)}%</strong></p>
                    <p className="text-sm">Behavior Score: <strong>{result.behaviorScore.toFixed(1)}%</strong></p>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Go Home
                  </button>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-center mb-4">Verification Denied</h2>
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
                  <p className="text-sm mb-2">AI Match Score: <strong>{result.matchScore.toFixed(1)}%</strong></p>
                  <p className="text-sm">Behavior Score: <strong>{result.behaviorScore.toFixed(1)}%</strong></p>
                </div>
                <p className="text-center opacity-80 mb-6">
                  Your verification was denied. Please contact support or try again later.
                </p>
                <button
                  onClick={() => {
                    setStep('upload_id')
                    setIdPhoto(null)
                    setIdPhotoUrl(null)
                    setSelfieUrl(null)
                    setResult(null)
                  }}
                  className="w-full px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

