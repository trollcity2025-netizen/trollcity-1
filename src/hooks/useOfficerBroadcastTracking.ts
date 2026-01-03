import { useEffect, useRef, useCallback } from "react" 
import { supabase, isAdminEmail } from "../lib/supabase" 
import { useAuthStore } from "../lib/store" 

type OfficerBroadcastTrackingArgs = { 
  streamId?: string 
  connected: boolean 
} 

export function useOfficerBroadcastTracking({ 
  streamId, 
  connected 
}: OfficerBroadcastTrackingArgs) { 
  const { profile, user } = useAuthStore() 

  const isOfficerRef = useRef(false) 
  const hasTrackedJoinRef = useRef(false) 
  const trackedStreamRef = useRef<string | null>(null) 
  const activityIntervalRef = useRef<number | null>(null) 
  const leaveCalledRef = useRef(false) 

  const getToken = useCallback(async () => { 
    const { data } = await supabase.auth.getSession() 
    return data.session?.access_token ?? null 
  }, []) 

  const getEdgeUrl = useCallback(() => { 
    return ( 
      import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
      "https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1" 
    ) 
  }, []) 

  useEffect(() => { 
    if (!profile || !user) { 
      isOfficerRef.current = false 
      return 
    } 

    const isAdmin = 
      profile.is_admin || profile.role === "admin" || isAdminEmail(user.email) 

    const isOfficer = 
      profile.role === "troll_officer" || profile.is_troll_officer === true 

    isOfficerRef.current = isAdmin || isOfficer 
  }, [profile, user]) 

  const trackJoin = useCallback(async () => { 
    if (!streamId || !user) return 
    if (!isOfficerRef.current) return 
    if (!connected) return 
    if (hasTrackedJoinRef.current) return 

    try { 
      const token = await getToken() 
      if (!token) return 

      const edgeUrl = getEdgeUrl() 
      const res = await fetch(`${edgeUrl}/officer-join-stream`, { 
        method: "POST", 
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        }, 
        body: JSON.stringify({ streamId }), 
        keepalive: true 
      }) 

      if (!res.ok) { 
        console.error("Failed to track officer join:", await res.text()) 
        return 
      } 

      hasTrackedJoinRef.current = true 
      trackedStreamRef.current = streamId 
      console.log("Officer join tracked (BroadcastPage)") 
    } catch (err) { 
      console.error("Officer join error:", err) 
    } 
  }, [streamId, user, connected, getToken, getEdgeUrl]) 

  const trackLeave = useCallback(async () => { 
    const trackedId = trackedStreamRef.current 
    if (!trackedId || !user) return 
    if (!isOfficerRef.current) return 
    if (!hasTrackedJoinRef.current) return 
    if (leaveCalledRef.current) return 

    leaveCalledRef.current = true 

    try { 
      const token = await getToken() 
      if (!token) return 

      const edgeUrl = getEdgeUrl() 
      const res = await fetch(`${edgeUrl}/officer-leave-stream`, { 
        method: "POST", 
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        }, 
        body: JSON.stringify({ streamId: trackedId }), 
        keepalive: true 
      }) 

      if (!res.ok) { 
        console.error("Failed to track officer leave:", await res.text()) 
        return 
      } 

      console.log("Officer leave tracked (BroadcastPage)") 
    } catch (err) { 
      console.error("Officer leave error:", err) 
    } 
  }, [user, getToken, getEdgeUrl]) 

  const trackActivity = useCallback(async () => { 
    if (!streamId || !user) return 
    if (!connected) return 
    if (!isOfficerRef.current) return 
    if (!hasTrackedJoinRef.current) return 

    try { 
      const token = await getToken() 
      if (!token) return 

      const edgeUrl = getEdgeUrl() 
      await fetch(`${edgeUrl}/officer-touch-activity`, { 
        method: "POST", 
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        }, 
        body: JSON.stringify({ streamId }), 
        keepalive: true 
      }) 
    } catch (err) { 
      console.error("Officer activity error:", err) 
    } 
  }, [streamId, user, connected, getToken, getEdgeUrl]) 

  // ✅ Join tracking: ONLY when connected becomes true 
  useEffect(() => { 
    if (!streamId || !connected) return 
    if (!user || !isOfficerRef.current) return 
    trackJoin() 
  }, [streamId, connected, user, trackJoin]) 

  // ✅ Activity interval 
  useEffect(() => { 
    if (!streamId || !connected) return 
    if (!user || !isOfficerRef.current) return 
    if (!hasTrackedJoinRef.current) return 

    activityIntervalRef.current = window.setInterval(() => { 
      trackActivity() 
    }, 5 * 60 * 1000) 

    return () => { 
      if (activityIntervalRef.current) { 
        clearInterval(activityIntervalRef.current) 
        activityIntervalRef.current = null 
      } 
    } 
  }, [streamId, connected, user, trackActivity]) 

  // ✅ Leave tracking ONCE on unmount 
  useEffect(() => { 
    return () => { 
      trackLeave() 
    } 
  }, [trackLeave]) 

  // ✅ Also track leave on unload (works with keepalive) 
  useEffect(() => { 
    const handleUnload = () => { 
      trackLeave() 
    } 

    window.addEventListener("beforeunload", handleUnload) 
    return () => { 
      window.removeEventListener("beforeunload", handleUnload) 
    } 
  }, [trackLeave]) 
} 
