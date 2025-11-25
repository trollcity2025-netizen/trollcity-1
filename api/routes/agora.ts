import { Router } from 'express'
import AgoraToken from 'agora-token'

// Use production-grade token builder

const router = Router()

// Generate Agora token
router.post('/agora-token', async (req, res) => {
  try {
    const { channelName, userId, role } = req.body // role: 'publisher' or 'subscriber'

    if (!channelName || !userId || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const appId = process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || process.env.VITE_AGORA_APP_CERTIFICATE

    if (!appId) {
      return res.status(500).json({ 
        error: 'Agora App ID not configured',
        details: 'VITE_AGORA_APP_ID not found in environment' 
      })
    }

    if (!appCertificate) {
      return res.status(500).json({ 
        error: 'Agora certificate not configured',
        details: 'Set AGORA_APP_CERTIFICATE (or VITE_AGORA_APP_CERTIFICATE) in .env'
      })
    }

    const agoraRole = role === 'publisher' ? AgoraToken.RtcRole.PUBLISHER : AgoraToken.RtcRole.SUBSCRIBER

    // Generate token with 24-hour expiration
    const expirationTimeInSeconds = 3600 * 24
    const currentTimestamp = Math.floor(Date.now() / 1000)

    // Build token using string account id to match client join
    const token = AgoraToken.RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      String(userId),
      agoraRole,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    )

    res.json({
      token,
      appId,
      channel: channelName,
      role: role,
      expiresAt: currentTimestamp + expirationTimeInSeconds
    })

  } catch (error: any) {
    console.error('Agora token error:', error)
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    })
  }
})

// Validate token
router.post('/validate-token', async (req, res) => {
  try {
    const { token, channelName, userId } = req.body

    if (!token || !channelName || !userId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Basic token validation (in production, implement proper validation)
    const isValid = token && token.length > 0

    res.json({
      valid: isValid,
      token,
      channel: channelName,
      userId
    })

  } catch (error: any) {
    console.error('Token validation error:', error)
    res.status(500).json({ 
      error: 'Failed to validate token',
      details: error.message 
    })
  }
})

export default router
