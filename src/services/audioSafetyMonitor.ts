/**
 * Troll City Background Audio Safety Monitor Service
 * 
 * This service handles server-side audio monitoring for safety detection.
 * It processes audio chunks, performs speech-to-text conversion, and
 * triggers safety alerts when dangerous phrases are detected.
 * 
 * IMPORTANT: This service NEVER stores full transcripts. Only trigger phrases
 * are stored when safety keywords are detected.
 */

import type {
  AudioChunkResult,
  CreateSafetyAlertResponse,
  DetectedKeyword,
  StreamMonitoringStatus,
  SafetyAlert
} from '@/types/safety';
import {
  detectSafetyKeywords,
  containsSafetyKeywords,
  shouldMonitorUserRole,
  getHighestSeverity,
  sanitizeTranscript
} from '@/lib/safetyKeywords';
import { supabase } from '@/lib/supabase';

// ============================================================
// CONFIGURATION
// ============================================================

// AUDIO_CHUNK_SIZE_MS = 5000 (5 second chunks) - reserved for future use
const MONITORING_INTERVAL_MS = 1000; // Check every second
const MAX_TRANSCRIPT_CACHE_SIZE = 100; // Keep only recent transcripts in memory

// ============================================================
// TYPES
// ============================================================

interface AudioChunk {
  id: string;
  streamId: string;
  userId: string;
  audioData: Blob | ArrayBuffer;
  timestamp: Date;
  userRole: string;
}

interface MonitoringSession {
  streamId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  totalChunks: number;
  triggerCount: number;
  isActive: boolean;
}

// ============================================================
// IN-MEMORY STORAGE (Privacy-compliant)
// ============================================================

// Transcript cache - automatically cleared, never persisted
const transcriptCache: Map<string, AudioChunkResult> = new Map();

// Active monitoring sessions
const activeSessions: Map<string, MonitoringSession> = new Map();

// ============================================================
// SPEECH RECOGNITION ENGINE INTERFACE
// ============================================================

/**
 * Interface for speech recognition engines
 * Implementations: Vosk, Whisper, DeepSpeech
 */
interface SpeechRecognitionEngine {
  initialize(): Promise<void>;
  transcribe(audioData: Blob | ArrayBuffer): Promise<string>;
  destroy(): Promise<void>;
}

/**
 * Web Speech API based recognition engine
 * Fallback for browsers that support it
 */
class _WebSpeechEngine implements SpeechRecognitionEngine {
  private recognition: SpeechRecognition | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.isInitialized = true;
    } else {
      throw new Error('Web Speech API not supported');
    }
  }

  async transcribe(_audioData: Blob | ArrayBuffer): Promise<string> {
    // Web Speech API doesn't work with pre-recorded audio blobs directly
    // This is a placeholder for actual implementation
    // In production, you'd use a server-side engine like Whisper
    return '';
  }

  async destroy(): Promise<void> {
    this.recognition?.stop();
    this.isInitialized = false;
  }
}

/**
 * Mock engine for testing without actual speech recognition
 */
class MockSpeechEngine implements SpeechRecognitionEngine {
  async initialize(): Promise<void> {
    console.log('[AudioSafety] Mock speech engine initialized');
  }

  async transcribe(_audioData: Blob | ArrayBuffer): Promise<string> {
    // Return empty string for mock
    return '';
  }

  async destroy(): Promise<void> {
    console.log('[AudioSafety] Mock speech engine destroyed');
  }
}

// ============================================================
// AUDIO SAFETY MONITOR CLASS
// ============================================================

export class AudioSafetyMonitor {
  private static instance: AudioSafetyMonitor;
  private engine: SpeechRecognitionEngine;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Use mock engine by default, replace with actual engine in production
    this.engine = new MockSpeechEngine();
  }

  static getInstance(): AudioSafetyMonitor {
    if (!AudioSafetyMonitor.instance) {
      AudioSafetyMonitor.instance = new AudioSafetyMonitor();
    }
    return AudioSafetyMonitor.instance;
  }

  /**
   * Initialize the audio safety monitor
   */
  async initialize(): Promise<void> {
    console.log('[AudioSafety] Initializing audio safety monitor...');
    await this.engine.initialize();
    this.isRunning = true;
    this.startMonitoringLoop();
    console.log('[AudioSafety] Audio safety monitor initialized');
  }

  /**
   * Start monitoring a stream
   */
  async startMonitoring(streamId: string, userId: string, userRole: string): Promise<boolean> {
    // Check if this role should be monitored
    if (!shouldMonitorUserRole(userRole)) {
      console.log(`[AudioSafety] User role ${userRole} not eligible for monitoring`);
      return false;
    }

    const sessionKey = `${streamId}:${userId}`;
    
    if (activeSessions.has(sessionKey)) {
      console.log(`[AudioSafety] Session ${sessionKey} already being monitored`);
      return true;
    }

    // Create monitoring session
    const session: MonitoringSession = {
      streamId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      totalChunks: 0,
      triggerCount: 0,
      isActive: true
    };

    activeSessions.set(sessionKey, session);

    // Update database
    try {
      await supabase
        .from('stream_audio_monitoring')
        .upsert({
          stream_id: streamId,
          user_id: userId,
          is_monitored: true,
          monitoring_started_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[AudioSafety] Failed to update monitoring status:', error);
    }

    console.log(`[AudioSafety] Started monitoring session: ${sessionKey}`);
    return true;
  }

  /**
   * Stop monitoring a stream
   */
  async stopMonitoring(streamId: string, userId: string): Promise<void> {
    const sessionKey = `${streamId}:${userId}`;
    const session = activeSessions.get(sessionKey);

    if (session) {
      session.isActive = false;
      activeSessions.delete(sessionKey);

      // Update database
      try {
        await supabase
          .from('stream_audio_monitoring')
          .update({
            is_monitored: false,
            monitoring_ended_at: new Date().toISOString()
          })
          .eq('stream_id', streamId)
          .eq('user_id', userId);
      } catch (error) {
        console.error('[AudioSafety] Failed to update monitoring status:', error);
      }

      console.log(`[AudioSafety] Stopped monitoring session: ${sessionKey}`);
    }
  }

  /**
   * Process an audio chunk for safety analysis
   * This is the main entry point for audio processing
   */
  async processAudioChunk(chunk: AudioChunk): Promise<AudioChunkResult | null> {
    const sessionKey = `${chunk.streamId}:${chunk.userId}`;
    const session = activeSessions.get(sessionKey);

    if (!session || !session.isActive) {
      return null;
    }

    // Update session stats
    session.totalChunks++;
    session.lastActivity = new Date();

    try {
      // Perform speech-to-text conversion
      const transcript = await this.engine.transcribe(chunk.audioData);

      // Check for safety keywords
      const detectedKeywords = detectSafetyKeywords(transcript);
      const shouldAlert = detectedKeywords.length > 0;

      const result: AudioChunkResult = {
        chunk_id: chunk.id,
        stream_id: chunk.streamId,
        user_id: chunk.userId,
        transcript: shouldAlert ? sanitizeTranscript(transcript, detectedKeywords) : '',
        detected_keywords: detectedKeywords,
        timestamp: new Date().toISOString(),
        should_alert: shouldAlert
      };

      // Store in cache temporarily (will be auto-cleared)
      this.addToCache(chunk.id, result);

      // Trigger alert if needed
      if (shouldAlert) {
        await this.handleSafetyAlert(result, detectedKeywords);
      }

      return result;

    } catch (error) {
      console.error('[AudioSafety] Error processing audio chunk:', error);
      return null;
    }
  }

  /**
   * Handle a safety alert - create database record and notify
   */
  private async handleSafetyAlert(
    result: AudioChunkResult, 
    detectedKeywords: DetectedKeyword[]
  ): Promise<void> {
    const highestSeverity = getHighestSeverity(detectedKeywords);
    const primaryKeyword = detectedKeywords[0];

    console.log(`[AudioSafety] ALERT DETECTED: ${primaryKeyword.category} - Level ${highestSeverity}`);

    try {
      // Call the database function to create alert
      const { data, error } = await supabase.rpc('create_safety_alert', {
        p_stream_id: result.stream_id,
        p_user_id: result.user_id,
        p_trigger_type: primaryKeyword.category,
        p_trigger_phrase: primaryKeyword.keyword
      });

      if (error) {
        console.error('[AudioSafety] Failed to create safety alert:', error);
        return;
      }

      const response = data as CreateSafetyAlertResponse;
      
      console.log(`[AudioSafety] Alert created: ID=${response.alert_id}, Level=${response.alert_level}, Total=${response.total_triggers}`);

      // Notify officers via realtime if high priority
      if (response.alert_level >= 2) {
        await this.notifyOfficers(result, response);
      }

    } catch (error) {
      console.error('[AudioSafety] Error handling safety alert:', error);
    }
  }

  /**
   * Notify officers of high-priority alerts
   */
  private async notifyOfficers(
    result: AudioChunkResult, 
    alertResponse: CreateSafetyAlertResponse
  ): Promise<void> {
    try {
      // Insert into notifications for officers
      const { error } = await supabase
        .from('notifications')
        .insert({
          type: 'safety_alert',
          title: `Safety Alert: ${alertResponse.alert_level === 3 ? 'HIGH PRIORITY' : 'Flagged'}`,
          message: `Alert detected in stream. Type: ${result.detected_keywords[0]?.category}. Triggers: ${alertResponse.total_triggers}`,
          metadata: {
            stream_id: result.stream_id,
            user_id: result.user_id,
            alert_level: alertResponse.alert_level,
            trigger_type: result.detected_keywords[0]?.category
          }
        });

      if (error) {
        console.error('[AudioSafety] Failed to notify officers:', error);
      }
    } catch (error) {
      console.error('[AudioSafety] Error notifying officers:', error);
    }
  }

  /**
   * Add result to cache with automatic cleanup
   */
  private addToCache(chunkId: string, result: AudioChunkResult): void {
    // Clear old entries if cache is full
    if (transcriptCache.size >= MAX_TRANSCRIPT_CACHE_SIZE) {
      const oldestKey = transcriptCache.keys().next().value;
      transcriptCache.delete(oldestKey);
    }

    transcriptCache.set(chunkId, result);

    // Auto-clear after 5 minutes for privacy
    setTimeout(() => {
      transcriptCache.delete(chunkId);
    }, 5 * 60 * 1000);
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoringLoop(): void {
    this.monitoringInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, MONITORING_INTERVAL_MS);
  }

  /**
   * Cleanup inactive monitoring sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const INACTIVE_THRESHOLD_MS = 30000; // 30 seconds

    for (const [key, session] of activeSessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > INACTIVE_THRESHOLD_MS) {
        console.log(`[AudioSafety] Cleaning up inactive session: ${key}`);
        this.stopMonitoring(session.streamId, session.userId);
      }
    }
  }

  /**
   * Get active monitoring sessions
   */
  getActiveSessions(): MonitoringSession[] {
    return Array.from(activeSessions.values());
  }

  /**
   * Get monitoring status for a stream
   */
  async getStreamMonitoringStatus(streamId: string): Promise<StreamMonitoringStatus | null> {
    try {
      const { data, error } = await supabase
        .from('stream_monitoring_status_view')
        .select('*')
        .eq('stream_id', streamId)
        .single();

      if (error) {
        console.error('[AudioSafety] Failed to get monitoring status:', error);
        return null;
      }

      return data as StreamMonitoringStatus;
    } catch (error) {
      console.error('[AudioSafety] Error getting monitoring status:', error);
      return null;
    }
  }

  /**
   * Get pending safety alerts
   */
  async getPendingAlerts(): Promise<SafetyAlert[]> {
    try {
      const { data, error } = await supabase
        .from('active_safety_alerts_view')
        .select('*')
        .order('alert_level', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AudioSafety] Failed to get pending alerts:', error);
        return [];
      }

      return data as SafetyAlert[];
    } catch (error) {
      console.error('[AudioSafety] Error getting pending alerts:', error);
      return [];
    }
  }

  /**
   * Shutdown the monitor
   */
  async shutdown(): Promise<void> {
    console.log('[AudioSafety] Shutting down audio safety monitor...');
    
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop all active sessions
    for (const [, session] of activeSessions.entries()) {
      await this.stopMonitoring(session.streamId, session.userId);
    }

    await this.engine.destroy();
    
    // Clear all cached transcripts
    transcriptCache.clear();

    console.log('[AudioSafety] Audio safety monitor shut down');
  }
}

// ============================================================
// EXPORT SINGLETON INSTANCE
// ============================================================

export const audioSafetyMonitor = AudioSafetyMonitor.getInstance();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if audio safety monitoring is available
 */
export function isAudioMonitoringAvailable(): boolean {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Quick check if text contains safety keywords (for client-side pre-filtering)
 */
export function quickSafetyCheck(text: string): boolean {
  return containsSafetyKeywords(text);
}
