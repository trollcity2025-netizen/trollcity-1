import { supabase } from '@/api/supabaseClient';
import { safetyVideoRecorder } from './safetyVideoRecorder';

// Safety monitoring utilities
export class SafetyMonitor {
  constructor() {
    this.keywords = [];
    this.isInitialized = false;
  }

  // Initialize safety monitor with keywords from database
  async initialize() {
    try {
      const { data, error } = await supabase
        .from('safety_keywords')
        .select('*')
        .eq('is_active', true)
        .order('severity_level', { ascending: false });

      if (error) {
        console.error('Error loading safety keywords:', error);
        return false;
      }

      this.keywords = data || [];
      this.isInitialized = true;
      console.log(`Safety monitor initialized with ${this.keywords.length} keywords`);
      return true;
    } catch (error) {
      console.error('Error initializing safety monitor:', error);
      return false;
    }
  }

  // Scan text for dangerous keywords
  scanText(text, userId = null, streamId = null, metadata = {}) {
    if (!this.isInitialized || !text) {
      return { incidents: [], isSafe: true };
    }

    const incidents = [];
    const lowerText = text.toLowerCase();
    
    for (const keyword of this.keywords) {
      if (lowerText.includes(keyword.keyword.toLowerCase())) {
        const incident = {
          keyword: keyword.keyword,
          severity: keyword.severity_level,
          category: keyword.category,
          description: keyword.description,
          context: this.extractContext(text, keyword.keyword),
          userId,
          streamId,
          timestamp: new Date().toISOString(),
          metadata
        };
        
        incidents.push(incident);
        
        // Auto-create incident for high-severity keywords
        if (keyword.severity_level >= 4) {
          this.createIncident(incident);
        }
      }
    }

    return {
      incidents,
      isSafe: incidents.length === 0,
      highestSeverity: Math.max(...incidents.map(i => i.severity), 0)
    };
  }

  // Extract context around the keyword
  extractContext(text, keyword) {
    const index = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (index === -1) return text;
    
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + keyword.length + 50);
    
    return text.substring(start, end);
  }

  // Create safety incident in database
  async createIncident(incidentData) {
    try {
      const incident = {
        user_id: incidentData.userId,
        stream_id: incidentData.streamId,
        detected_keyword_id: this.keywords.find(k => k.keyword === incidentData.keyword)?.id,
        incident_type: 'keyword_detected',
        severity_level: incidentData.severity,
        context_text: incidentData.context,
        is_emergency: incidentData.severity >= 5,
        ip_address: incidentData.metadata?.ipAddress,
        user_agent: incidentData.metadata?.userAgent,
        created_at: incidentData.timestamp
      };

      const { data, error } = await supabase
        .from('safety_incidents')
        .insert(incident)
        .select()
        .single();

      if (error) {
        console.error('Error creating safety incident:', error);
        return null;
      }

      // Trigger emergency notifications for high-severity incidents
      if (incidentData.severity >= 5) {
        this.triggerEmergencyAlert(data);
      }

      return data;
    } catch (error) {
      console.error('Error creating safety incident:', error);
      return null;
    }
  }

  // Trigger emergency alert for high-severity incidents
  async triggerEmergencyAlert(incident) {
    try {
      // Get user's location if available
      const location = await this.getUserLocation(incident.user_id);
      
      // Update incident with location data
      if (location) {
        await supabase
          .from('safety_incidents')
          .update({
            location_latitude: location.latitude,
            location_longitude: location.longitude,
            location_accuracy: location.accuracy
          })
          .eq('id', incident.id);
      }

      // Start video recording for emergency incidents
      if (incident.severity_level >= 5 && incident.stream_id) {
        await safetyVideoRecorder.startRecording(incident.stream_id, incident.id);
      }

      // Send notifications to troll officers and admins
      await this.notifySafetyTeam(incident, location);

      // For highest severity (5), also notify police
      if (incident.severity_level >= 5) {
        await this.notifyPolice(incident, location);
      }

    } catch (error) {
      console.error('Error triggering emergency alert:', error);
    }
  }

  // Get user's location if they have consented
  async getUserLocation(userId) {
    try {
      // Check if user has consented to location sharing
      const { data: consent } = await supabase
        .from('user_location_consent')
        .select('*')
        .eq('user_id', userId)
        .eq('has_consented', true)
        .single();

      if (!consent) {
        return null;
      }

      // Get location from browser (this would be called from frontend)
      // For now, return null as we need frontend implementation
      return null;
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  }

  // Notify safety team (troll officers and admins)
  async notifySafetyTeam(incident, location = null) {
    try {
      // Get all troll officers and admins
      const { data: safetyTeam } = await supabase
        .from('auth.users')
        .select('id, email, raw_user_meta_data')
        .or('role.eq.troll_officer,role.eq.admin');

      if (!safetyTeam || safetyTeam.length === 0) {
        console.warn('No safety team members found');
        return;
      }

      const notifications = safetyTeam.map(member => ({
        incident_id: incident.id,
        notified_user_id: member.id,
        notification_type: member.raw_user_meta_data?.role === 'admin' ? 'admin' : 'troll_officer',
        notification_method: 'dashboard',
        message_content: `🚨 SAFETY ALERT: ${incident.severity_level === 5 ? 'EMERGENCY' : 'HIGH RISK'} incident detected. User mentioned "${incident.context_text}". ${location ? `Location: ${location.latitude}, ${location.longitude}` : 'No location available'}.`,
        is_sent: true,
        sent_at: new Date().toISOString()
      }));

      await supabase
        .from('safety_notifications')
        .insert(notifications);

      console.log(`Notified ${safetyTeam.length} safety team members`);
    } catch (error) {
      console.error('Error notifying safety team:', error);
    }
  }

  // Notify local police (placeholder - would integrate with real police APIs)
  async notifyPolice(incident, location) {
    try {
      // Call the Supabase function to notify police
      const { data, error } = await supabase.functions.invoke('notifyPolice', {
        body: { incidentId: incident.id }
      });

      if (error) {
        console.error('Error calling notifyPolice function:', error);
        return;
      }

      console.log(`Police notification sent for incident ${incident.id}:`, data);
    } catch (error) {
      console.error('Error notifying police:', error);
    }
  }

  // Start recording video for incident (to be called from frontend)
  async startVideoRecording(streamId, incidentId) {
    // This will be implemented in the frontend to start recording
    // and upload to Supabase storage
    console.log(`Starting video recording for stream ${streamId}, incident ${incidentId}`);
  }

  // Stop recording and save video
  async stopVideoRecording(incidentId, videoUrl, videoPath) {
    try {
      await supabase
        .from('safety_incidents')
        .update({
          video_clip_url: videoUrl,
          video_clip_path: videoPath
        })
        .eq('id', incidentId);

      console.log(`Video saved for incident ${incidentId}`);
    } catch (error) {
      console.error('Error saving video recording:', error);
    }
  }
}

// Create singleton instance
export const safetyMonitor = new SafetyMonitor();

// Initialize on module load
safetyMonitor.initialize().then(success => {
  if (success) {
    console.log('Safety monitor ready');
  } else {
    console.warn('Safety monitor failed to initialize');
  }
});