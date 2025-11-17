import { supabase } from '@/api/supabaseClient';

// Video recording manager for safety incidents
export class SafetyVideoRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.streamId = null;
    this.incidentId = null;
  }

  // Start recording video from a stream
  async startRecording(streamId, incidentId, options = {}) {
    try {
      this.streamId = streamId;
      this.incidentId = incidentId;
      
      // Get the video element from the DOM
      const videoElement = document.querySelector(`video[data-stream-id="${streamId}"]`);
      if (!videoElement) {
        console.warn('Video element not found for stream:', streamId);
        return false;
      }

      // Create a canvas to capture video frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;

      // Create MediaRecorder from canvas stream
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Add audio if available
      if (videoElement.srcObject && videoElement.srcObject.getAudioTracks) {
        const audioTracks = videoElement.srcObject.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => canvasStream.addTrack(track));
        }
      }

      // Configure MediaRecorder
      const mediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000, // 128 kbps
      };

      this.mediaRecorder = new MediaRecorder(canvasStream, mediaRecorderOptions);
      this.recordedChunks = [];
      this.startTime = Date.now();
      this.isRecording = true;

      // Capture frames continuously
      const captureFrame = () => {
        if (!this.isRecording) return;
        
        try {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.warn('Error capturing video frame:', error);
        }
        
        if (this.isRecording) {
          requestAnimationFrame(captureFrame);
        }
      };

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          await this.uploadRecording(blob);
        } catch (error) {
          console.error('Error processing recording:', error);
        }
        
        // Clean up
        canvasStream.getTracks().forEach(track => track.stop());
        canvas.remove();
      };

      // Start recording
      this.mediaRecorder.start(1000); // Capture every 1000ms
      captureFrame();

      console.log(`Started safety recording for incident ${incidentId}, stream ${streamId}`);
      return true;

    } catch (error) {
      console.error('Error starting video recording:', error);
      return false;
    }
  }

  // Stop recording and upload
  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      console.warn('No active recording to stop');
      return;
    }

    this.isRecording = false;
    this.mediaRecorder.stop();
    
    const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    console.log(`Stopped safety recording after ${duration.toFixed(1)} seconds`);
  }

  // Upload recording to Supabase storage
  async uploadRecording(blob) {
    try {
      if (!this.incidentId) {
        console.error('No incident ID for upload');
        return;
      }

      const fileName = `safety-incident-${this.incidentId}-${Date.now()}.webm`;
      const filePath = `safety-recordings/${fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('safety-videos')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading recording:', error);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('safety-videos')
        .getPublicUrl(filePath);

      // Update incident with video URL
      await supabase
        .from('safety_incidents')
        .update({
          video_clip_url: publicUrl,
          video_clip_path: filePath,
          recording_duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0
        })
        .eq('id', this.incidentId);

      console.log(`Uploaded safety recording: ${publicUrl}`);
      return publicUrl;

    } catch (error) {
      console.error('Error uploading recording:', error);
      return null;
    }
  }

  // Get recording status
  getStatus() {
    return {
      isRecording: this.isRecording,
      startTime: this.startTime,
      duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      streamId: this.streamId,
      incidentId: this.incidentId
    };
  }

  // Clean up resources
  cleanup() {
    if (this.isRecording) {
      this.stopRecording();
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.streamId = null;
    this.incidentId = null;
    this.startTime = null;
  }
}

// Create singleton instance
export const safetyVideoRecorder = new SafetyVideoRecorder();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    safetyVideoRecorder.cleanup();
  });
}