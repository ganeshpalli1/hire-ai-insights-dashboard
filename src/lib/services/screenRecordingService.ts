/**
 * Enhanced Screen Recording Service
 * - 720p video quality
 * - 48kHz audio quality  
 * - Mixed audio sources (system + microphone)
 * - No recording controls exposed to user
 * - Unlimited recording length
 * - Direct Azure Blob upload after completion
 */

interface RecordingConfig {
  video: {
    width: 1280;
    height: 720;
    frameRate: 30;
  };
  audio: {
    sampleRate: 48000;
    echoCancellation: true;
    noiseSuppression: true;
  };
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number | null;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  error: string | null;
}

export class ScreenRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  public screenStream: MediaStream | null = null; // Made public to check audio tracks
  private audioStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private persistRecording: boolean = false; // Flag to prevent accidental cleanup
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    startTime: null,
    recordingBlob: null,
    recordingUrl: null,
    error: null
  };

  private readonly config: RecordingConfig = {
    video: {
      width: 1280,
      height: 720,
      frameRate: 30
    },
    audio: {
      sampleRate: 48000,
      echoCancellation: true,
      noiseSuppression: true
    }
  };

  /**
   * Initialize recording capabilities
   */
  async initializeRecording(): Promise<boolean> {
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen recording not supported in this browser');
      }

      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          throw new Error('WebM recording not supported');
        }
      }

      console.log('✅ Screen recording service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize screen recording:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Start comprehensive screen + audio recording
   */
  async startRecording(): Promise<boolean> {
    try {
      if (this.state.isRecording) {
        console.warn('Recording already in progress');
        return false;
      }

      // Reset state
      this.recordedChunks = [];
      this.state.error = null;
      this.state.recordingBlob = null;
      this.state.recordingUrl = null;

      // 1. Get screen capture with audio
      console.log('🎥 Requesting screen capture with system audio...');
      console.log('⚠️ IMPORTANT: Please check "Share audio" in the screen sharing dialog to record system sounds!');
      
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: this.config.video.width,
          height: this.config.video.height,
          frameRate: this.config.video.frameRate
        } as MediaTrackConstraints,
        audio: true // Request system audio - user must check "Share audio" checkbox
      });

      // Check if screen stream has audio
      const screenHasAudio = this.screenStream.getAudioTracks().length > 0;
      console.log(`🔊 System audio capture: ${screenHasAudio ? 'YES ✅' : 'NO ❌'}`);
      
      if (!screenHasAudio) {
        console.warn('⚠️ System audio not captured! Make sure to check "Share audio" when sharing screen.');
      }

      // 2. Get microphone audio separately
      console.log('🎤 Requesting microphone access...');
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.audio.sampleRate,
          echoCancellation: this.config.audio.echoCancellation,
          noiseSuppression: this.config.audio.noiseSuppression,
          autoGainControl: true
        }
      });

      // 3. Combine all streams
      console.log('🔄 Combining audio streams...');
      console.log(`📊 Audio sources: System (${screenHasAudio ? 'Active' : 'Missing'}), Microphone (Active)`);
      this.combinedStream = this.combineAudioStreams(this.screenStream, this.audioStream);

      // 4. Set up MediaRecorder with optimal settings
      const mimeType = this.getBestMimeType();
      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000, // 5 Mbps for 720p
        audioBitsPerSecond: 192000   // 192 kbps for 48kHz
      });

      // 5. Configure recording event handlers
      this.setupRecordingEventHandlers();

      // 6. Start recording
      this.mediaRecorder.start(1000); // Collect data every 1 second
      this.state.isRecording = true;
      this.state.startTime = Date.now();

      console.log('✅ Screen recording started successfully');
      console.log(`📊 Recording config:`, {
        video: `${this.config.video.width}x${this.config.video.height}@${this.config.video.frameRate}fps`,
        audio: `${this.config.audio.sampleRate}Hz`,
        mimeType: mimeType
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to start screen recording:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      await this.cleanupStreams();
      return false;
    }
  }

  /**
   * Set persist flag to prevent accidental cleanup during navigation
   */
  setPersistRecording(persist: boolean): void {
    this.persistRecording = persist;
    console.log(`🔒 Recording persistence set to: ${persist}`);
  }

  /**
   * Stop recording and prepare for upload
   */
  async stopRecording(): Promise<Blob | null> {
    try {
      if (!this.state.isRecording || !this.mediaRecorder) {
        console.warn('No active recording to stop');
        return null;
      }
      
      // Reset persist flag when explicitly stopping
      this.persistRecording = false;

      console.log('⏹️ Stopping screen recording...');

      return new Promise((resolve) => {
        if (!this.mediaRecorder) {
          resolve(null);
          return;
        }

        this.mediaRecorder.onstop = () => {
          console.log('✅ Recording stopped successfully');
          this.state.isRecording = false;
          this.state.startTime = null;
          
          // Create final blob
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          this.state.recordingBlob = blob;
          
          // Create URL for preview (optional)
          this.state.recordingUrl = URL.createObjectURL(blob);
          
          console.log(`📊 Recording completed: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
          
          this.cleanupStreams();
          resolve(blob);
        };

        this.mediaRecorder.stop();
      });
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      return null;
    }
  }

  /**
   * Combine screen audio and microphone audio
   */
  private combineAudioStreams(screenStream: MediaStream, micStream: MediaStream): MediaStream {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const destination = audioContext.createMediaStreamDestination();
    
    // Get video track from screen stream
    const videoTrack = screenStream.getVideoTracks()[0];
    
    // Create audio sources
    const screenAudioTracks = screenStream.getAudioTracks();
    const micAudioTracks = micStream.getAudioTracks();
    
    // Connect screen audio if available
    if (screenAudioTracks.length > 0) {
      const screenAudioSource = audioContext.createMediaStreamSource(
        new MediaStream([screenAudioTracks[0]])
      );
      screenAudioSource.connect(destination);
    }
    
    // Connect microphone audio
    if (micAudioTracks.length > 0) {
      const micAudioSource = audioContext.createMediaStreamSource(
        new MediaStream([micAudioTracks[0]])
      );
      micAudioSource.connect(destination);
    }
    
    // Combine video and mixed audio
    const combinedStream = new MediaStream([
      videoTrack,
      ...destination.stream.getAudioTracks()
    ]);
    
    return combinedStream;
  }

  /**
   * Get the best supported MIME type
   */
  private getBestMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'video/webm'; // Fallback
  }

  /**
   * Setup MediaRecorder event handlers
   */
  private setupRecordingEventHandlers(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        console.log(`📦 Recorded chunk: ${(event.data.size / 1024).toFixed(2)} KB`);
      }
    };

    this.mediaRecorder.onstart = () => {
      console.log('🎬 Recording started');
    };

    this.mediaRecorder.onpause = () => {
      console.log('⏸️ Recording paused');
      this.state.isPaused = true;
    };

    this.mediaRecorder.onresume = () => {
      console.log('▶️ Recording resumed');
      this.state.isPaused = false;
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('❌ Recording error:', event);
      this.state.error = 'Recording error occurred';
    };

    // Handle stream ending (user stops screen share)
    if (this.screenStream) {
      this.screenStream.getVideoTracks()[0].onended = () => {
        console.log('🔚 Screen sharing ended by user');
        // Only stop if not persisting
        if (!this.persistRecording) {
          this.stopRecording();
        } else {
          console.log('🔒 Recording persisted - not stopping automatically');
        }
      };
    }
  }

  /**
   * Clean up all streams and resources
   */
  private async cleanupStreams(): Promise<void> {
    try {
      console.log('🧹 Starting stream cleanup...');
      console.trace('Cleanup called from:'); // This will show the call stack
      
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => {
          console.log(`🛑 Stopping track: ${track.kind} - ${track.label}`);
          track.stop();
        });
        this.screenStream = null;
      }

      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      if (this.combinedStream) {
        this.combinedStream.getTracks().forEach(track => track.stop());
        this.combinedStream = null;
      }

      this.mediaRecorder = null;
      console.log('🧹 Recording streams cleaned up');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return { ...this.state };
  }

  /**
   * Get recording duration in seconds
   */
  getRecordingDuration(): number {
    if (!this.state.startTime) return 0;
    return Math.floor((Date.now() - this.state.startTime) / 1000);
  }

  /**
   * Check if recording is supported
   */
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getDisplayMedia &&
      window.MediaRecorder
    );
  }
}

// Export singleton instance
export const screenRecorder = new ScreenRecordingService(); 