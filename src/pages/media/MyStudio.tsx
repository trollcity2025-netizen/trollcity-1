import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Mic, Square, Play, Pause, Download, Trash2, 
  Volume2, Wand2, Save, Upload, Music, Layers,
  Mic2, Radio, Settings, Plus, X, FileAudio,
  Headphones, VolumeX
} from 'lucide-react';
import { trollCityTheme } from '@/styles/trollCityTheme';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { StudioProject } from '@/types/media';

type RecordingMode = 'voice_only' | 'voice_beat' | 'multitrack';
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface BeatTrack {
  id: string;
  name: string;
  url: string;
  file?: File;
}

export default function MyStudio() {
  const { user } = useAuthStore();
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('voice_only');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [showEffects, setShowEffects] = useState(false);
  const [appliedEffects, setAppliedEffects] = useState<string[]>([]);
  
  // Beat-related state
  const [beatTrack, setBeatTrack] = useState<BeatTrack | null>(null);
  const [beatVolume, setBeatVolume] = useState(0.7);
  const [isBeatPlaying, setIsBeatPlaying] = useState(false);
  const [beatPlaybackTime, setBeatPlaybackTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const beatInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const EFFECTS = [
    { id: 'reverb', name: 'Reverb', icon: Radio, description: 'Add space and depth' },
    { id: 'compression', name: 'Compression', icon: Volume2, description: 'Even out dynamics' },
    { id: 'eq', name: 'EQ', icon: Settings, description: 'Shape your tone' },
    { id: 'noise_reduction', name: 'Noise Gate', icon: Wand2, description: 'Remove background noise' },
    { id: 'autotune', name: 'Auto-Tune', icon: Mic2, description: 'Pitch correction' },
    { id: 'delay', name: 'Delay', icon: Layers, description: 'Echo effects' },
  ];

  // Load user's projects on mount
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user?.id]);

  const loadProjects = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('studio_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setProjects(data as StudioProject[] || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // Visualizer animation
  useEffect(() => {
    if (recordingState === 'recording' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw simulated waveform
        ctx.beginPath();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        
        const time = Date.now() / 100;
        for (let x = 0; x < canvas.width; x += 5) {
          const amplitude = recordingState === 'recording' 
            ? Math.sin(x * 0.02 + time) * 30 + Math.random() * 20
            : Math.sin(x * 0.02 + time) * 5;
          const y = canvas.height / 2 + amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        animationRef.current = requestAnimationFrame(draw);
      };

      draw();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recordingState]);

  // Handle beat playback during recording
  useEffect(() => {
    if (beatTrack?.url && beatAudioRef.current) {
      beatAudioRef.current.volume = beatVolume;
    }
  }, [beatVolume, beatTrack]);

  const handleBeatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file');
      return;
    }

    const url = URL.createObjectURL(file);
    setBeatTrack({
      id: Date.now().toString(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      url,
      file
    });
    toast.success('Beat uploaded successfully!');
  };

  const removeBeat = () => {
    if (beatTrack?.url) {
      URL.revokeObjectURL(beatTrack.url);
    }
    setBeatTrack(null);
    setIsBeatPlaying(false);
    setBeatPlaybackTime(0);
  };

  const toggleBeatPlayback = () => {
    if (!beatAudioRef.current || !beatTrack) return;
    
    if (isBeatPlaying) {
      beatAudioRef.current.pause();
      setIsBeatPlaying(false);
    } else {
      beatAudioRef.current.play();
      setIsBeatPlaying(true);
    }
  };

  const startRecording = async () => {
    try {
      // Start beat playback if in voice_beat mode
      if (recordingMode === 'voice_beat' && beatTrack && beatAudioRef.current) {
        beatAudioRef.current.currentTime = 0;
        beatAudioRef.current.play();
        setIsBeatPlaying(true);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        
        // Stop beat playback
        if (beatAudioRef.current) {
          beatAudioRef.current.pause();
          setIsBeatPlaying(false);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Pause beat playback
      if (beatAudioRef.current && recordingMode === 'voice_beat') {
        beatAudioRef.current.pause();
        setIsBeatPlaying(false);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Resume beat playback
      if (beatAudioRef.current && recordingMode === 'voice_beat') {
        beatAudioRef.current.play();
        setIsBeatPlaying(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingState('stopped');
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop beat playback
      if (beatAudioRef.current) {
        beatAudioRef.current.pause();
        setIsBeatPlaying(false);
      }
    }
  };

  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];
    
    // Reset beat
    if (beatAudioRef.current) {
      beatAudioRef.current.currentTime = 0;
    }
  };

  const saveProject = async () => {
    if (!user || !audioBlob) return;

    try {
      // Upload vocal recording
      const vocalFileName = `studio-vocal-${user.id}-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(vocalFileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl: vocalUrl } } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(vocalFileName);

      // If beat mode, also upload the beat
      let beatUrl = null;
      if (recordingMode === 'voice_beat' && beatTrack?.file) {
        const beatFileName = `studio-beat-${user.id}-${Date.now()}-${beatTrack.file.name}`;
        const { data: beatUploadData, error: beatUploadError } = await supabase.storage
          .from('audio-recordings')
          .upload(beatFileName, beatTrack.file);
        
        if (!beatUploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('audio-recordings')
            .getPublicUrl(beatFileName);
          beatUrl = publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('studio_projects')
        .insert({
          user_id: user.id,
          title: projectName || `Recording ${new Date().toLocaleString()}`,
          project_type: recordingMode === 'voice_only' ? 'recording' : 'multitrack',
          status: 'completed',
          mixed_track_url: vocalUrl,
          beat_url: beatUrl,
          duration: recordingTime,
          effects_applied: appliedEffects,
          recording_mode: recordingMode,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Project saved successfully!');
      setProjects(prev => [data as StudioProject, ...prev]);
      resetRecording();
      setProjectName('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleEffect = (effectId: string) => {
    setAppliedEffects(prev => 
      prev.includes(effectId) 
        ? prev.filter(e => e !== effectId)
        : [...prev, effectId]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for beat upload */}
      <input
        ref={beatInputRef}
        type="file"
        accept="audio/*"
        onChange={handleBeatUpload}
        className="hidden"
      />

      {/* Recording Mode Selector */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { id: 'voice_only', label: 'Voice Only', desc: 'Record clean vocals', icon: Mic },
          { id: 'voice_beat', label: 'Voice + Beat', desc: 'Sing over instrumentals', icon: Music },
          { id: 'multitrack', label: 'Multi Track', desc: 'Layer multiple tracks', icon: Layers },
        ].map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => recordingState === 'idle' && setRecordingMode(mode.id as RecordingMode)}
              disabled={recordingState !== 'idle'}
              className={`
                p-4 rounded-2xl border-2 transition-all text-left
                ${recordingMode === mode.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
                }
                ${recordingState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${recordingMode === mode.id ? 'text-purple-400' : 'text-gray-400'}`} />
                <p className="font-semibold text-white">{mode.label}</p>
              </div>
              <p className="text-sm text-gray-400 pl-8">{mode.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Beat Upload Section - Only for Voice + Beat mode */}
      {recordingMode === 'voice_beat' && (
        <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-pink-400" />
              Beat Track
            </h3>
            {!beatTrack && recordingState === 'idle' && (
              <button
                onClick={() => beatInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Beat
              </button>
            )}
          </div>

          {!beatTrack ? (
            <div 
              onClick={() => recordingState === 'idle' && beatInputRef.current?.click()}
              className={`
                border-2 border-dashed border-white/20 rounded-xl p-8 text-center
                ${recordingState === 'idle' ? 'hover:border-purple-500/50 cursor-pointer' : ''}
              `}
            >
              <Music className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p className="text-gray-400 mb-1">Upload a beat to record over</p>
              <p className="text-sm text-gray-500">MP3, WAV, or any audio file</p>
            </div>
          ) : (
            <div className="bg-black/40 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleBeatPlayback}
                  disabled={recordingState === 'recording'}
                  className="w-12 h-12 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center transition-all disabled:opacity-50"
                >
                  {isBeatPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{beatTrack.name}</p>
                  <p className="text-sm text-gray-400">
                    {isBeatPlaying ? 'Playing' : 'Ready to play'}
                  </p>
                </div>
                {recordingState === 'idle' && (
                  <button
                    onClick={removeBeat}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Beat Volume Control */}
              <div className="flex items-center gap-3 mt-4">
                <VolumeX className="w-4 h-4 text-gray-500" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={beatVolume}
                  onChange={(e) => setBeatVolume(parseFloat(e.target.value))}
                  disabled={recordingState === 'recording'}
                  className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
                <Volume2 className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          )}

          {/* Hidden audio element for beat */}
          {beatTrack && (
            <audio
              ref={beatAudioRef}
              src={beatTrack.url}
              loop
              onEnded={() => setIsBeatPlaying(false)}
              onTimeUpdate={(e) => setBeatPlaybackTime(e.currentTarget.currentTime)}
            />
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Recording Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-8`}>
            {/* Visualizer */}
            <div className="h-32 bg-black/40 rounded-xl mb-8 flex items-center justify-center gap-1 overflow-hidden">
              {recordingState !== 'idle' ? (
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={128}
                  className="w-full h-full"
                />
              ) : audioUrl ? (
                <div className="text-center w-full px-8">
                  <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Ready to record</p>
                  {recordingMode === 'voice_beat' && !beatTrack && (
                    <p className="text-sm text-pink-400 mt-1">Upload a beat first</p>
                  )}
                </div>
              )}
            </div>

            {/* Timer */}
            <div className="text-center mb-8">
              <div className="text-6xl font-mono font-bold text-white tabular-nums">
                {formatTime(recordingTime)}
              </div>
              {recordingState === 'recording' && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-medium">Recording</span>
                  {recordingMode === 'voice_beat' && beatTrack && (
                    <span className="text-pink-400 text-sm ml-2">with Beat</span>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {recordingState === 'idle' && (
                <button
                  onClick={startRecording}
                  disabled={recordingMode === 'voice_beat' && !beatTrack}
                  className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 flex items-center justify-center transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mic className="w-8 h-8 text-white" />
                </button>
              )}

              {recordingState === 'recording' && (
                <>
                  <button
                    onClick={pauseRecording}
                    className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-400 flex items-center justify-center transition-all"
                  >
                    <Pause className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-all"
                  >
                    <Square className="w-8 h-8 text-white" fill="white" />
                  </button>
                </>
              )}

              {recordingState === 'paused' && (
                <>
                  <button
                    onClick={resumeRecording}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-all"
                  >
                    <Play className="w-6 h-6 text-white ml-1" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-all"
                  >
                    <Square className="w-8 h-8 text-white" fill="white" />
                  </button>
                </>
              )}

              {recordingState === 'stopped' && audioUrl && (
                <>
                  <button
                    onClick={() => audioRef.current?.play()}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-all"
                  >
                    <Play className="w-6 h-6 text-white ml-1" />
                  </button>
                  <button
                    onClick={resetRecording}
                    className="w-16 h-16 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Effects Panel */}
          {recordingState === 'stopped' && audioUrl && (
            <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  Effects & Processing
                </h3>
                <button
                  onClick={() => setShowEffects(!showEffects)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  {showEffects ? 'Hide' : 'Show'} Effects
                </button>
              </div>

              {showEffects && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {EFFECTS.map((effect) => {
                    const Icon = effect.icon;
                    const isActive = appliedEffects.includes(effect.id);
                    return (
                      <button
                        key={effect.id}
                        onClick={() => toggleEffect(effect.id)}
                        className={`
                          p-3 rounded-xl border transition-all text-left
                          ${isActive
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-white/10 bg-white/5 hover:border-white/30'
                          }
                        `}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                        <p className={`font-medium text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                          {effect.name}
                        </p>
                        <p className="text-xs text-gray-500">{effect.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Save Project */}
          {recordingState === 'stopped' && audioUrl && (
            <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-400" />
                Save Project
              </h3>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name..."
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 mb-4"
              />
              <button
                onClick={saveProject}
                disabled={!projectName}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save to Library
              </button>
            </div>
          )}

          {/* Recent Projects */}
          <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Recent Projects
            </h3>
            
            {projects.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No saved projects yet. Start recording!
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Music className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{project.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(project.duration || 0)} • {project.recording_mode || project.project_type}
                      </p>
                    </div>
                    {project.mixed_track_url && (
                      <button 
                        onClick={() => {
                          const audio = new Audio(project.mixed_track_url);
                          audio.play();
                        }}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                      >
                        <Play className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
            <h3 className="font-semibold text-white mb-3">Studio Tips</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Use headphones to prevent feedback
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Record in a quiet environment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Keep 6-12 inches from microphone
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Do a sound check before recording
              </li>
              {recordingMode === 'voice_beat' && (
                <li className="flex items-start gap-2">
                  <span className="text-pink-400">•</span>
                  Upload your beat first, then record
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
