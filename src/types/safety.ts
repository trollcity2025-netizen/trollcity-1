/**
 * Troll City Background Audio Safety & Location System Types
 * 
 * This file contains all type definitions for:
 * - Audio safety monitoring
 * - Safety alerts
 * - User geolocation
 * - Admin audit logging
 */

// ============================================================
// SAFETY ALERT TYPES
// ============================================================

export type SafetyTriggerType = 'SELF_HARM' | 'THREAT' | 'VIOLENCE' | 'ABUSE';

export type AlertLevel = 1 | 2 | 3;

export interface SafetyAlert {
  id: string;
  stream_id: string;
  user_id: string;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
  audio_chunk_timestamp: string;
  alert_level: AlertLevel;
  reviewed_by?: string;
  action_taken?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface SafetyAlertWithDetails extends SafetyAlert {
  user_username: string;
  stream_title?: string;
  reviewer_username?: string;
  total_triggers?: number;
  alert_status: 'HIGH PRIORITY' | 'FLAGGED' | 'NOTIFICATION';
}

export interface CreateSafetyAlertRequest {
  stream_id: string;
  user_id: string;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
}

export interface CreateSafetyAlertResponse {
  alert_id: string;
  alert_level: AlertLevel;
  total_triggers: number;
}

export interface ReviewSafetyAlertRequest {
  alert_id: string;
  action_taken: SafetyAction;
}

// ============================================================
// SAFETY ACTIONS
// ============================================================

export type SafetyAction =
  | 'JOIN_STREAM'
  | 'REVIEW_STREAM'
  | 'ISSUE_WARNING'
  | 'END_BROADCAST'
  | 'SEND_TO_TROLL_COURT'
  | 'PLACE_IN_TROLL_JAIL'
  | 'DISMISSED'
  | 'NO_ACTION';

export interface SafetyActionOption {
  value: SafetyAction;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  icon: string;
}

export const SAFETY_ACTIONS: SafetyActionOption[] = [
  {
    value: 'JOIN_STREAM',
    label: 'Join Stream',
    description: 'Enter the stream to observe the situation',
    severity: 'low',
    icon: 'Eye'
  },
  {
    value: 'REVIEW_STREAM',
    label: 'Review Stream',
    description: 'Mark stream for closer monitoring',
    severity: 'low',
    icon: 'Search'
  },
  {
    value: 'ISSUE_WARNING',
    label: 'Issue Warning',
    description: 'Send warning to the user',
    severity: 'medium',
    icon: 'AlertTriangle'
  },
  {
    value: 'END_BROADCAST',
    label: 'End Broadcast',
    description: 'Immediately terminate the stream',
    severity: 'high',
    icon: 'StopCircle'
  },
  {
    value: 'SEND_TO_TROLL_COURT',
    label: 'Send to Troll Court',
    description: 'Escalate to judicial review',
    severity: 'high',
    icon: 'Gavel'
  },
  {
    value: 'PLACE_IN_TROLL_JAIL',
    label: 'Place in Troll Jail',
    description: 'Immediate detention pending review',
    severity: 'high',
    icon: 'Lock'
  }
];

// ============================================================
// KEYWORD DETECTION TYPES
// ============================================================

export interface KeywordCategory {
  name: SafetyTriggerType;
  keywords: string[];
  severity: AlertLevel;
  description: string;
}

export interface DetectedKeyword {
  category: SafetyTriggerType;
  keyword: string;
  severity: AlertLevel;
  position: number;
}

export interface AudioChunkResult {
  chunk_id: string;
  stream_id: string;
  user_id: string;
  transcript: string;
  detected_keywords: DetectedKeyword[];
  timestamp: string;
  should_alert: boolean;
}

// ============================================================
// USER LOCATION TYPES
// ============================================================

export interface UserIpLocation {
  id: string;
  user_id: string;
  ip_address: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  organization?: string;
  timezone?: string;
  source: 'login' | 'signup' | 'manual_lookup';
  created_at: string;
}

export interface UserLocationWithProfile extends UserIpLocation {
  username: string;
  email?: string;
  role: string;
}

export interface UserLocationSearchRequest {
  search_type: 'username' | 'user_id' | 'ip_address';
  search_value: string;
}

export interface EmergencyUserInfo {
  user_id: string;
  username: string;
  email?: string;
  latest_ip?: string;
  city?: string;
  state?: string;
  country?: string;
  isp?: string;
  last_seen?: string;
}

// ============================================================
// AUDIT LOG TYPES
// ============================================================

export type AuditActionType =
  | 'safety_alert_generated'
  | 'safety_alert_reviewed'
  | 'admin_location_lookup'
  | 'emergency_info_accessed'
  | 'stream_ended_safety'
  | 'warning_issued_safety'
  | 'troll_court_referral'
  | 'user_jailed_safety';

export interface AdminAuditLog {
  id: string;
  admin_id?: string;
  action_type: AuditActionType;
  target_user_id?: string;
  target_stream_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AdminAuditLogWithDetails extends AdminAuditLog {
  admin_username?: string;
  target_username?: string;
  stream_title?: string;
}

// ============================================================
// STREAM MONITORING TYPES
// ============================================================

export interface StreamAudioMonitoring {
  id: string;
  stream_id: string;
  user_id: string;
  is_monitored: boolean;
  monitoring_started_at: string;
  monitoring_ended_at?: string;
  total_triggers: number;
  last_trigger_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StreamMonitoringStatus {
  stream_id: string;
  title: string;
  category?: string;
  user_id: string;
  broadcaster_name: string;
  is_live: boolean;
  current_viewers: number;
  is_monitored?: boolean;
  monitoring_started_at?: string;
  total_triggers?: number;
  last_trigger_at?: string;
  pending_alerts: number;
  highest_alert_level?: AlertLevel;
}

// ============================================================
// DASHBOARD VIEW TYPES
// ============================================================

export interface SafetyAlertDashboardItem {
  id: string;
  stream_id: string;
  user_id: string;
  user_username: string;
  stream_title?: string;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
  alert_level: AlertLevel;
  alert_status: string;
  audio_chunk_timestamp: string;
  created_at: string;
  total_triggers?: number;
}

export interface LocationIntelligenceItem {
  user_id: string;
  username: string;
  role: string;
  email?: string;
  ip_address: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  organization?: string;
  timezone?: string;
  source: string;
  last_seen: string;
}

// ============================================================
// OFFICER DASHBOARD TYPES
// ============================================================

export interface SafetyAlertFilters {
  trigger_type?: SafetyTriggerType;
  alert_level?: AlertLevel;
  date_from?: string;
  date_to?: string;
  search_query?: string;
}

export interface AlertStats {
  total_alerts_today: number;
  unreviewed_alerts: number;
  high_priority_alerts: number;
  alerts_by_type: Record<SafetyTriggerType, number>;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface SafetySystemStatus {
  is_monitoring_active: boolean;
  active_monitored_streams: number;
  total_alerts_24h: number;
  alerts_requiring_review: number;
}

export interface GeolocationApiResponse {
  ip: string;
  city?: string;
  region?: string;
  region_code?: string;
  country?: string;
  country_code?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;
}

// ============================================================
// PERMISSION TYPES
// ============================================================

export type LocationAccessRole = 'super_admin' | 'platform_admin';
export type SafetyAlertAccessRole = 'admin' | 'troll_officer' | 'lead_troll_officer' | 'moderator' | 'super_admin' | 'platform_admin';

export const LOCATION_ACCESS_ROLES: LocationAccessRole[] = ['super_admin', 'platform_admin'];
export const SAFETY_ALERT_ACCESS_ROLES: SafetyAlertAccessRole[] = [
  'admin',
  'troll_officer',
  'lead_troll_officer',
  'moderator',
  'super_admin',
  'platform_admin'
];
