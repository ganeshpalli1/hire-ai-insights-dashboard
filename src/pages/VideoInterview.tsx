import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { FaMicrophone, FaClock, FaMicrophoneSlash, FaExpand, FaCompress, FaVideo, FaUpload } from 'react-icons/fa';
import { useConversation } from '@11labs/react';
import { InterviewService } from '../lib/services';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { screenRecorder } from '../lib/services/screenRecordingService';
import { azureBlobService } from '../lib/services/azureBlobService';

const INTERVIEW_DURATION = 15 * 60; // 15 minutes in seconds

const rounds = [
  { name: 'Screening round', active: true },
  { name: 'Technical round', active: false },
  { name: 'Behavioral round', active: false },
];

interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export const VideoInterview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [timer, setTimer] = useState(INTERVIEW_DURATION);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(30);
  const [volume, setVolume] = useState(0.7);
  const [micMuted, setMicMuted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Screen recording state
  const [recordingState, setRecordingState] = useState<any>({
    isRecording: false,
    duration: 0,
    error: null
  });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Fullscreen and anti-cheating state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [cheatingFlags, setCheatingFlags] = useState<string[]>([]);
  const [warningTimer, setWarningTimer] = useState(180); // 3 minutes in seconds
  const [warningTimerActive, setWarningTimerActive] = useState(false);
  
  const navigate = useNavigate();

  // AI interviewer questions for demo
  const aiQuestions = [
    'As a UX designer, can you share a specific example of how you adapted your communication style to effectively convey complex design concepts to a non-technical stakeholder?',
    'Why are you interested in this position?',
    'Describe a challenge you faced at work and how you handled it.',
    'Where do you see yourself in 5 years?',
  ];

  // Fullscreen API functions
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
      toast.error('Failed to enter fullscreen mode. Please enable fullscreen for a secure interview.');
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  };

  // Monitor fullscreen changes for anti-cheating
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If interview is running and user exits fullscreen
      if (interviewStarted && !isCurrentlyFullscreen && isFullscreen) {
        const newCount = fullscreenExitCount + 1;
        setFullscreenExitCount(newCount);
        
        // Add cheating flag
        const flag = `Fullscreen exit #${newCount} at ${new Date().toLocaleTimeString()}`;
        setCheatingFlags(prev => [...prev, flag]);
        
        // Show warning dialog and start timer
        setShowFullscreenWarning(true);
        setWarningTimer(180); // Reset to 3 minutes
        setWarningTimerActive(true);
        
        toast.warning('⚠️ Security Alert: Fullscreen mode exited', {
          description: `This action has been recorded. You have 3 minutes to return. Count: ${newCount}`,
        });
        
        // Auto re-enter fullscreen after 3 seconds if interview is still running
        setTimeout(() => {
          if (interviewStarted && !isFullscreen) {
            enterFullscreen();
          }
        }, 3000);
      }
      
      // If user returns to fullscreen, stop the warning timer
      if (interviewStarted && isCurrentlyFullscreen && !isFullscreen && warningTimerActive) {
        setWarningTimerActive(false);
        setShowFullscreenWarning(false);
        setWarningTimer(180); // Reset timer
        
        toast.success('✅ Secure mode restored', {
          description: 'Thank you for returning to fullscreen mode.',
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [interviewStarted, isFullscreen, fullscreenExitCount, warningTimerActive]);

  // Detect tab visibility changes (another anti-cheating measure)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (interviewStarted && document.hidden) {
        const flag = `Tab switch/minimize detected at ${new Date().toLocaleTimeString()}`;
        setCheatingFlags(prev => [...prev, flag]);
        
        toast.warning('⚠️ Security Alert: Tab visibility changed', {
          description: 'This action has been recorded.',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [interviewStarted]);

  // Warning timer countdown (3 minutes to return to fullscreen)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (warningTimerActive && warningTimer > 0) {
      interval = setInterval(() => {
        setWarningTimer((prev) => {
          if (prev <= 1) {
            // Timer expired - automatically end interview
            setWarningTimerActive(false);
            setShowFullscreenWarning(false);
            
            toast.error('⚠️ Interview Terminated', {
              description: 'Failed to return to secure mode within 3 minutes.',
            });
            
            // Add final cheating flag
            setCheatingFlags(prev => [...prev, `Interview terminated due to security timeout at ${new Date().toLocaleTimeString()}`]);
            
            // End the interview
            endInterview();
            
            return 180; // Reset timer
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [warningTimerActive, warningTimer]);

  // Initialize AI avatar video with better error handling
  useEffect(() => {
    if (aiVideoRef.current) {
      const video = aiVideoRef.current;
      
      // Function to update video status display
      const updateVideoStatus = (status: string) => {
        const statusElement = document.getElementById('video-status');
        if (statusElement) {
          statusElement.textContent = status;
        }
        console.log('Video Status:', status);
      };
      
      // Reset any previous errors
      video.removeAttribute('src');
      updateVideoStatus('Initializing...');
      
      // Set up video properties first
      video.preload = 'metadata';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true; // Don't autoplay until we explicitly call play
      
      // Add event listeners for debugging
      video.addEventListener('loadstart', () => {
        console.log('AI Video: Load started');
        updateVideoStatus('Loading...');
      });
      video.addEventListener('loadedmetadata', () => {
        console.log('AI Video: Metadata loaded');
        console.log('Video duration:', video.duration);
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        updateVideoStatus('Metadata loaded');
      });
      video.addEventListener('loadeddata', () => {
        console.log('AI Video: Data loaded');
        updateVideoStatus('Data loaded');
      });
      video.addEventListener('canplay', () => {
        console.log('AI Video: Can play');
        updateVideoStatus('Ready');
      });
      video.addEventListener('canplaythrough', () => {
        console.log('AI Video: Can play through');
        updateVideoStatus('Ready to play');
      });
      video.addEventListener('playing', () => {
        console.log('AI Video: Playing');
        updateVideoStatus('Playing');
      });
      video.addEventListener('pause', () => {
        console.log('AI Video: Paused');
        updateVideoStatus('Paused');
      });
      video.addEventListener('error', (e) => {
        console.error('AI Video: Error event', e);
        updateVideoStatus('Error');
        const error = video.error;
        if (error) {
          console.error('AI Video: Error details:', {
            code: error.code,
            message: error.message,
            MEDIA_ERR_ABORTED: error.MEDIA_ERR_ABORTED,
            MEDIA_ERR_NETWORK: error.MEDIA_ERR_NETWORK,
            MEDIA_ERR_DECODE: error.MEDIA_ERR_DECODE,
            MEDIA_ERR_SRC_NOT_SUPPORTED: error.MEDIA_ERR_SRC_NOT_SUPPORTED
          });
        }
        
        // Show fallback on error
        const fallback = document.getElementById('ai-avatar-fallback');
        if (fallback) {
          fallback.style.display = 'flex';
          video.style.display = 'none';
        }
      });
      video.addEventListener('stalled', () => {
        console.log('AI Video: Stalled');
        updateVideoStatus('Stalled');
      });
      video.addEventListener('waiting', () => {
        console.log('AI Video: Waiting');
        updateVideoStatus('Buffering...');
      });
      
      // Try multiple video sources with fallback options
      const tryLoadVideo = async () => {
        try {
          updateVideoStatus('Setting up video...');
          
          // Use the Azure Blob Storage URL for the AI avatar video
          const aiAvatarVideoUrl = 'https://pdf1.blob.core.windows.net/interviewvideo/ai-avatar.mp4';
          
          console.log('Loading AI Avatar video from Azure Blob Storage...');
          updateVideoStatus('Loading AI Avatar...');
          
          // Set the video source directly to the blob URL
          video.src = aiAvatarVideoUrl;
          video.load();
          
          console.log('Video source set to:', aiAvatarVideoUrl);
          
        } catch (error) {
          console.error('❌ Failed to set up video:', error);
          updateVideoStatus('Setup failed');
          
          // Show fallback immediately
          const fallback = document.getElementById('ai-avatar-fallback');
          if (fallback) {
            fallback.style.display = 'flex';
            video.style.display = 'none';
          }
        }
      };
      
      tryLoadVideo();
    }
  }, []);

  // Handle interview end - reset video state
  useEffect(() => {
    if (aiVideoRef.current && !interviewStarted) {
      const video = aiVideoRef.current;
      console.log('AI Video: Interview ended, resetting video');
      video.pause();
      video.currentTime = 0;
      
      // Hide fallback and show video element
      const fallback = document.getElementById('ai-avatar-fallback');
      if (fallback) {
        fallback.style.display = 'none';
        video.style.display = 'block';
      }
    }
  }, [interviewStarted]);

  // Get session ID from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    if (sessionId) {
      loadInterviewSession(sessionId);
    }
  }, []);

  // Initialize recording services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize screen recording
        const recordingSupported = await screenRecorder.initializeRecording();
        if (!recordingSupported) {
          console.warn('⚠️ Screen recording not supported in this browser');
          toast.warning('Screen recording not supported in this browser');
        }

        // Test Azure Blob Storage connectivity first
        console.log('🧪 Testing Azure Storage connectivity...');
        const connectivityTest = await azureBlobService.testConnection();
        
        if (connectivityTest) {
          // Initialize Azure Blob Storage
          const storageInitialized = await azureBlobService.initialize();
          if (!storageInitialized) {
            console.warn('⚠️ Azure Storage initialization failed');
            toast.warning('Video storage initialization failed - recordings will not be saved');
          } else {
            console.log('✅ Azure Storage ready for recording uploads');
          }
        } else {
          console.warn('⚠️ Azure Storage connectivity test failed');
          toast.warning('Video storage not accessible - recordings will not be saved');
        }

        console.log('✅ Recording services initialized');
      } catch (error) {
        console.error('❌ Failed to initialize recording services:', error);
      }
    };

    initializeServices();
  }, []);

  // Update recording state periodically
  useEffect(() => {
    if (!recordingState.isRecording) return;

    const interval = setInterval(() => {
      const state = screenRecorder.getState();
      const duration = screenRecorder.getRecordingDuration();
      
      setRecordingState({
        isRecording: state.isRecording,
        duration: duration,
        error: state.error
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingState.isRecording]);

  const loadInterviewSession = async (sessionId: string) => {
    setLoadingSession(true);
    setError('');
    
    try {
      console.log('Loading interview session:', sessionId);
      const session = await InterviewService.getInterviewSession(sessionId);
      
      console.log('Session loaded successfully:', {
        candidate: session.candidate_name,
        questions: session.generated_questions?.questions?.length,
        status: session.status
      });
      
      setSessionData(session);
      setCustomPrompt(session.interview_prompt);
      
      // Show welcome message
      toast.success(
        `Welcome ${session.candidate_name}!`,
        {
          description: 'Your personalized interview is ready. Click "Start Interview" to begin.',
        }
      );
      
    } catch (error) {
      console.error('Error loading interview session:', error);
      setError(`Failed to load interview session: ${error.message}`);
      toast.error('Interview session not found', {
        description: 'The interview link may be invalid or expired.',
      });
    } finally {
      setLoadingSession(false);
    }
  };

  // Interview configuration
  const interviewConfig = {
    systemPrompt: customPrompt || `You are an expert AI interviewer conducting a comprehensive technical interview. 
    Your approach should be:
    - Professional yet friendly
    - Ask follow-up questions based on responses
    - Evaluate technical depth and problem-solving skills
    - Provide encouragement while maintaining standards
    - Keep responses concise and engaging
    
    Ask one question at a time and wait for the candidate's response before proceeding.`,
    
    firstMessage: sessionData 
      ? `Hello ${sessionData.candidate_name}! Welcome to your personalized video interview. I'm excited to learn about your experience and skills based on your background. Are you ready to begin?`
      : "Hello! Welcome to your video interview. I'm excited to learn about your experience and skills. Let's start with you telling me about your background and what interests you about this position.",
    
    voiceId: "L0Dsvb3SLTyegXwtm47J" // Custom voice
  };

  // Initialize conversation with ElevenLabs
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      setError('');
    },
    
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
    },
    
    onMessage: (message) => {
      handleMessage(message);
    },
    
    onError: (error) => {
      console.error('Conversation error:', error);
      setError('An error occurred with the AI interviewer. Please check your connection and try again.');
    },
    
    clientTools: {
      saveKeyPoint: (parameters: { category: string; point: string; importance: 'high' | 'medium' | 'low' }) => {
        console.log('Key point saved:', parameters);
        return "Key point recorded successfully";
      },
      
      generateReport: () => {
        const report = {
          candidatePerformance: "Based on the conversation...",
          strengths: ["Strong technical knowledge", "Good communication"],
          areasForImprovement: ["System design experience"],
          recommendation: "Proceed to next round"
        };
        console.log('Interview report:', report);
        return JSON.stringify(report);
      }
    },
    
    overrides: {
      agent: {
        prompt: {
          prompt: interviewConfig.systemPrompt
        },
        firstMessage: interviewConfig.firstMessage,
        language: "en"
      },
      tts: {
        voiceId: interviewConfig.voiceId
      }
    },
    
    volume,
    micMuted
  });

  // Control AI avatar video playback - only when AI is speaking
  useEffect(() => {
    if (aiVideoRef.current && interviewStarted) {
      const video = aiVideoRef.current;
      
      if (conversation.isSpeaking) {
        console.log('AI Video: AI started speaking, playing avatar video');
        
        const playVideo = async () => {
          try {
            // Check if video is ready
            if (video.readyState < 2) { // HAVE_CURRENT_DATA
              console.log('AI Video: Waiting for video to be ready...');
              
              // Wait for video to be ready or timeout
              await new Promise((resolve) => {
                const onReady = () => {
                  console.log('AI Video: Video is now ready');
                  video.removeEventListener('canplay', onReady);
                  video.removeEventListener('loadeddata', onReady);
                  resolve(true);
                };
                
                video.addEventListener('canplay', onReady);
                video.addEventListener('loadeddata', onReady);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                  video.removeEventListener('canplay', onReady);
                  video.removeEventListener('loadeddata', onReady);
                  resolve(false);
                }, 5000);
              });
            }
            
            // Ensure video properties are set
            video.muted = true;
            video.loop = true;
            video.volume = 0;
            
            // Try to play
            console.log('AI Video: Attempting to play while AI is speaking...');
            await video.play();
            console.log('✅ AI Video: Successfully started playing during AI speech');
            
          } catch (error) {
            console.error('❌ AI Video: Failed to play:', error);
            
            // Show fallback content
            const fallback = document.getElementById('ai-avatar-fallback');
            if (fallback) {
              fallback.style.display = 'flex';
              console.log('Showing fallback content due to play failure');
            }
            
            // Try again after user interaction
            setTimeout(() => {
              console.log('AI Video: Retrying play after delay...');
              video.play().catch(retryError => {
                console.error('AI Video: Retry also failed:', retryError);
              });
            }, 1000);
          }
        };
        
        playVideo();
        
      } else {
        console.log('AI Video: AI stopped speaking, pausing avatar video');
        video.pause();
        
        // Hide fallback and show video element (but paused)
        const fallback = document.getElementById('ai-avatar-fallback');
        if (fallback) {
          fallback.style.display = 'none';
          video.style.display = 'block';
        }
      }
    }
  }, [interviewStarted, conversation.isSpeaking]);

  // Handle incoming messages from AI
  const handleMessage = (message: any) => {
    console.log('Received message:', message);
    console.log('Message type:', message.type);
    console.log('Message source:', message.source);
    console.log('Message content:', message.message);
    console.log('Full message object:', JSON.stringify(message, null, 2));
    
    // Handle the standard ElevenLabs message structure
    if (message.source === 'user' && message.message) {
      console.log('Adding user message:', message.message);
      addTranscriptEntry('user', message.message);
    } else if (message.source === 'ai' && message.message) {
      console.log('Adding AI message:', message.message);
      addTranscriptEntry('agent', message.message);
    }
    
    // Try to extract conversation ID if we don't have it yet
    if (!conversationId) {
      const msgConvId = message.conversationId || 
                       message.conversation_id || 
                       message.conversationUuid ||
                       message.id ||
                       message.metadata?.conversation_id ||
                       message.metadata?.conversationId ||
                       message.metadata?.conversationUuid;
                       
      if (msgConvId) {
        console.log('Found conversation ID in message:', msgConvId);
        setConversationId(msgConvId);
        
        // Optionally update the session if we have one
        if (sessionData?.session_id) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net';
          fetch(`${apiBaseUrl}/api/interviews/${sessionData.session_id}/update-conversation`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: msgConvId })
          }).catch(err => console.error('Failed to update session:', err));
        }
      }
    }
  };

  // Add entry to transcript
  const addTranscriptEntry = (speaker: 'user' | 'agent', text: string) => {
    console.log(`Adding transcript entry - Speaker: ${speaker}, Text: ${text}`);
    
    // Skip empty or very short messages
    if (!text || text.trim().length < 2) {
      console.log('Skipping empty or very short message');
      return;
    }
    
    const entry: TranscriptEntry = {
      id: `${Date.now()}-${Math.random()}`,
      speaker,
      text: text.trim(),
      timestamp: new Date(),
      isFinal: true
    };
    
    setTranscript(prev => {
      // Check if this exact message was just added (within last 2 seconds)
      const recentThreshold = 2000; // 2 seconds
      const now = new Date().getTime();
      
      const isDuplicate = prev.some(existingEntry => 
        existingEntry.speaker === speaker &&
        existingEntry.text === text.trim() &&
        (now - new Date(existingEntry.timestamp).getTime()) < recentThreshold
      );
      
      if (isDuplicate) {
        console.log('Duplicate message detected, skipping:', text);
        return prev;
      }
      
      const newTranscript = [...prev, entry];
      console.log('Updated transcript:', newTranscript);
      return newTranscript;
    });
  };

  // Test function to check video accessibility
  const testVideoAccess = async () => {
    console.log('Testing video file accessibility...');
    
    try {
      // Test if the video file is accessible
      const response = await fetch('/ai-avatar.mp4', { method: 'HEAD' });
      console.log('Video file HTTP status:', response.status);
      console.log('Video file content-type:', response.headers.get('content-type'));
      console.log('Video file size:', response.headers.get('content-length'));
      
      if (response.ok) {
        console.log('✅ Video file is accessible');
        
        // Test creating a video element programmatically
        const testVideo = document.createElement('video');
        testVideo.src = '/ai-avatar.mp4';
        testVideo.muted = true;
        testVideo.preload = 'metadata';
        
        testVideo.addEventListener('loadedmetadata', () => {
          console.log('✅ Video metadata loaded successfully');
          console.log('Video duration:', testVideo.duration);
          console.log('Video dimensions:', testVideo.videoWidth, 'x', testVideo.videoHeight);
        });
        
        testVideo.addEventListener('error', (e) => {
          console.error('❌ Video test error:', e);
        });
        
        testVideo.load();
        
      } else {
        console.error('❌ Video file not accessible:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to test video access:', error);
    }
  };

  // Test function to add sample transcript (for debugging)
  const addTestTranscript = () => {
    addTranscriptEntry('agent', 'Hello! This is a test message from the AI interviewer.');
    setTimeout(() => {
      addTranscriptEntry('user', 'This is a test response from the user.');
    }, 1000);
    
    // Also test video access
    testVideoAccess();
  };

  useEffect(() => {
    if (interviewStarted && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [interviewStarted, timer]);

  // Camera access (VIDEO ONLY - no audio to prevent feedback) - Start immediately when page loads
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(stream);
        console.log('✅ Camera access granted and stream started');
      } catch (err) {
        console.error('❌ Camera error:', err);
        toast.error('Camera access required', {
          description: 'Please allow camera access for the video interview.',
        });
      }
    };

    // Start camera immediately when component loads
    initializeCamera();

    // Cleanup function to stop camera when component unmounts
    return () => {
      if (cameraStream) {
        console.log('Stopping camera stream...');
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Empty dependency array means this runs once when component mounts

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Timer formatting
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Format timer display
  const formatWarningTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Start interview with AI
  const startInterview = async () => {
    try {
      // Step 1: Request microphone access for ElevenLabs conversation
      await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      
      // Step 2: Request screen recording permission BEFORE entering fullscreen
      console.log('🎬 Requesting screen recording permission...');
      
      // Show reminder about system audio
      toast.info('🎤 Screen Recording Permission', {
        description: '✅ Please select your screen and enable "Share audio" to record the AI interviewer\'s voice!',
        duration: 6000
      });
      
      // Start recording (this will show the permission dialog)
      const recordingStarted = await screenRecorder.startRecording();
      
      if (!recordingStarted) {
        console.warn('⚠️ Failed to start screen recording');
        toast.error('Screen recording permission denied', {
          description: 'Screen recording is required for the interview. Please reload and try again.',
          duration: 5000
        });
        return; // Don't proceed without recording
      }
      
      // Step 3: NOW enter fullscreen mode (after permission is granted)
      console.log('🔒 Entering fullscreen mode...');
      await enterFullscreen();
      
      // Give a moment for fullscreen to fully activate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify we're in fullscreen
      const isInFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      
      if (!isInFullscreen) {
        console.warn('⚠️ Failed to enter fullscreen, retrying...');
        await enterFullscreen();
      }
      
      // Recording is already started, just update the state
      setRecordingState({
        isRecording: true,
        duration: 0,
        error: null
      });
      console.log('✅ Screen recording started successfully');
      
      // Check recording state to see if system audio was captured
      const recordingStateInfo = screenRecorder.getState();
      console.log('📊 Recording state:', recordingStateInfo);
      
      toast.success('🎥 Interview started', {
        description: 'You are now in secure fullscreen mode.',
        duration: 3000
      });
      
      // Get agent ID - hardcoded ElevenLabs agent ID
      const agentId = 'agent_01jw4mdjgvef2rmm7e3kgnsrzp'; // Hardcoded ElevenLabs agent ID
      console.log('Using ElevenLabs Agent ID:', agentId);
      
      let sessionResponse: any;
      
      // Try to get signed URL from backend first, then fallback to direct agent ID
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net';
        const response = await fetch(`${apiBaseUrl}/api/elevenlabs/signed-url?agentId=${agentId}`);
        
        if (response.ok) {
          const { signed_url } = await response.json();
          console.log('Got signed URL, starting session...');
          sessionResponse = await conversation.startSession({ signedUrl: signed_url });
        } else {
          throw new Error('Backend endpoint not available');
        }
      } catch (backendError) {
        console.log('Backend not available, trying direct agent ID:', backendError);
        console.log('Attempting to start session with agent ID:', agentId);
        
        // Fallback: try to start session directly with agent ID (for public agents)
        try {
        sessionResponse = await conversation.startSession({ agentId: agentId });
        } catch (agentError) {
          console.error('Direct agent connection failed:', agentError);
          throw new Error(`Failed to connect to ElevenLabs agent. Please check that your agent ID "${agentId}" is correct and publicly accessible. Error: ${agentError.message}`);
        }
      }
      
      // Log the entire session response to debug
      console.log('Session response:', sessionResponse);
      console.log('Session response type:', typeof sessionResponse);
      console.log('Session response keys:', sessionResponse ? Object.keys(sessionResponse) : 'null');
      
      // Try to extract conversation ID from various possible locations
      if (sessionResponse) {
        const possibleConvId = sessionResponse.conversationUuid || 
                            sessionResponse.conversationId || 
                            sessionResponse.conversation_id ||
                            sessionResponse.id ||
                            sessionResponse.uuid;
                            
        if (possibleConvId) {
          console.log('Found conversation ID in session response:', possibleConvId);
          setConversationId(possibleConvId);
        } else {
          console.warn('No conversation ID found in session response');
        }
      }
      
      // Also check the conversation object itself
      console.log('Conversation object:', conversation);
      console.log('Conversation object type:', typeof conversation);
      if (conversation && typeof conversation === 'object') {
        const convKeys = Object.keys(conversation);
        console.log('Conversation object keys:', convKeys);
        
        // Try to find conversation ID in the conversation object
        const convObj = conversation as any;
        const convId = convObj.conversationId || convObj.conversationUuid || convObj.id || convObj.conversation_id;
        if (convId && !conversationId) {
          console.log('Found conversation ID in conversation object:', convId);
          setConversationId(convId);
        }
      }
      
      setInterviewStarted(true);
      setError('');
      
      // Show security notice
      toast.success('Interview started in secure fullscreen mode', {
        description: 'Do not exit fullscreen or switch tabs during the interview.',
      });
      
      console.log('Interview started successfully!');
    } catch (err) {
      console.error('Failed to start interview:', err);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Failed to start interview. ';
      
      if (err.message.includes('demo-agent-id')) {
        errorMessage += 'Please configure your ElevenLabs Agent ID in the environment variables.';
      } else if (err.message.includes('agent ID')) {
        errorMessage += 'Please check your ElevenLabs Agent ID configuration.';
      } else {
        errorMessage += err.message || 'Please check your ElevenLabs setup.';
      }
      
      setError(errorMessage);
      
      // Don't start basic interview mode for production - require proper configuration
      toast.error('ElevenLabs Configuration Required', {
        description: 'Please configure your ElevenLabs Agent ID to enable AI interviews.',
      });
    }
  };

  // End interview
  const endInterview = async () => {
    try {
      // Stop the ElevenLabs conversation
      if (conversation.status === 'connected') {
        try {
          await conversation.endSession();
        } catch (wsErr) {
          console.warn('endSession warning:', wsErr);
        }
      }
      
      // Exit fullscreen mode
      if (isFullscreen) {
        await exitFullscreen();
      }
      
      let recordingBlob: Blob | null = null;
      
      // Stop screen recording
      if (recordingState.isRecording) {
        console.log('⏹️ Stopping screen recording...');
        try {
          recordingBlob = await screenRecorder.stopRecording();
          console.log(`📁 Recording size: ${recordingBlob ? (recordingBlob.size / 1024 / 1024).toFixed(2) : 0} MB`);
        } catch (recordingError) {
          console.error('❌ Error stopping recording:', recordingError);
          toast.error('Failed to stop recording', {
            description: 'But your interview data is safe.',
          });
        }
      }
      
      // If we have session data and recording, navigate to upload progress page
      if (sessionData?.session_id && recordingBlob) {
        toast.info('Interview completed!', {
          description: 'Processing your recording...',
        });
        
        // Navigate to upload progress page with all necessary data
        navigate('/upload-progress', {
          state: {
            recordingBlob,
            sessionData,
            recordingDuration: recordingState.duration,
            transcript,
            cheatingFlags,
            fullscreenExitCount
          }
        });
      } else if (sessionData?.session_id) {
        // No recording but have session data - go directly to results
        toast.info('Interview completed!', {
          description: 'Redirecting to results...',
        });
        
        // Try to send transcript for analysis even without recording
        try {
          const filteredTranscript = transcript.filter((entry, index, arr) => {
            const firstIndex = arr.findIndex(e => 
              e.speaker === entry.speaker && 
              e.text === entry.text
            );
            return firstIndex === index;
          });
          
          // Handle empty transcript case
          let transcriptText = '';
          let startTime = new Date();
          let endTime = new Date();
          let durationSeconds = 0;
          
          if (filteredTranscript.length > 0) {
            transcriptText = filteredTranscript
              .map(entry => `${entry.speaker === 'agent' ? 'AI' : 'USER'}: ${entry.text}`)
              .join('\n');
            startTime = filteredTranscript[0]?.timestamp || new Date();
            endTime = filteredTranscript[filteredTranscript.length - 1]?.timestamp || new Date();
            durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          } else {
            // Create minimal transcript for incomplete interview
            console.log('No transcript entries found - creating minimal transcript');
            transcriptText = 'USER: Interview ended early.\nAI: Interview was terminated before completion.';
            durationSeconds = 1; // Minimal duration
          }
          
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net';
          const response = await fetch(`${apiBaseUrl}/api/interviews/${sessionData.session_id}/complete-with-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: transcriptText,
              transcript_entries: filteredTranscript.length > 0 ? filteredTranscript : [],
              started_at: startTime.toISOString(),
              ended_at: endTime.toISOString(),
              duration_seconds: durationSeconds || 1,
              cheating_flags: cheatingFlags,
              fullscreen_exit_count: fullscreenExitCount
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Analysis API error:', errorData);
            toast.warning('Interview analysis may be incomplete', {
              description: 'But you can still view the results.',
            });
          }
        } catch (err) {
          console.error('Analysis error:', err);
          toast.warning('Interview analysis failed', {
            description: 'But you can still view available results.',
          });
        }
        
        // Always navigate to results, even if analysis failed
        navigate(`/interview-results?session=${sessionData.session_id}`);
      } else {
        // No session data - just end the interview
        toast.info('Interview ended');
        navigate('/dashboard');
      }
      
    } catch (err) {
      console.error('Error ending interview:', err);
      toast.error('Error ending interview', {
        description: 'Please contact support if the issue persists.',
      });
    }
    
    // Reset state
    setInterviewStarted(false);
    setTranscript([]);
    setCurrentTranscript('');
    setConversationId(null);
    setRecordingState({
      isRecording: false,
      duration: 0,
      error: null
    });
    
    // Reset anti-cheating counters
    setFullscreenExitCount(0);
    setCheatingFlags([]);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-7xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 ml-6">
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[#ff6b35] tracking-tight">Utilitarian Labs</span>
            <span className="text-sm text-gray-600 -mt-1">Accelerating Excellence</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center">
          {/* Session info or Progress bar */}
          {sessionData ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-blue-700 mb-1">
                Personalized Interview for {sessionData.candidate_name}
              </h2>
              <p className="text-sm text-gray-600">
                {sessionData.generated_questions?.questions?.length || 7} custom questions prepared
              </p>
            </div>
          ) : (
            <div className="flex gap-4 items-center mb-1">
              {rounds.map((r, i) => (
                <div key={r.name} className="flex flex-col items-center">
                  <div className={`h-2 w-24 rounded-full ${r.active ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <span className={`text-xs mt-1 ${r.active ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[#1a2343] font-semibold text-lg">
          Total interview time : <FaClock /> <span className="font-mono">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="w-full max-w-7xl mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Security Warning Dialog */}
      <Dialog open={showFullscreenWarning} onOpenChange={setShowFullscreenWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              ⚠️ Critical Security Alert
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              You have exited fullscreen mode during the interview. This action has been recorded for security purposes.
            </p>
            
            {/* Countdown Timer */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <FaClock className="text-red-600" />
                <span className="text-lg font-bold text-red-600">
                  {formatWarningTime(warningTimer)}
                </span>
              </div>
              <p className="text-xs text-center text-red-700 font-medium">
                Time remaining to return to secure mode
              </p>
              <p className="text-xs text-center text-red-600 mt-1">
                ⚠️ Interview will be automatically terminated if timer expires
              </p>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>Exit Count:</strong> {fullscreenExitCount}<br/>
                <strong>Time:</strong> {new Date().toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setShowFullscreenWarning(false);
                  setWarningTimerActive(false);
                  setWarningTimer(180);
                  enterFullscreen();
                }} 
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Return to Fullscreen Now
              </Button>
              <Button 
                onClick={() => {
                  setShowFullscreenWarning(false);
                  setWarningTimerActive(false);
                  toast.info('Warning dismissed - Timer still active');
                }} 
                variant="outline"
                className="text-xs"
              >
                Dismiss
              </Button>
            </div>
            
            <p className="text-xs text-gray-600 text-center">
              You can dismiss this dialog, but the timer will continue running in the background.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Status Bar (only visible when interview is running) */}
      {interviewStarted && (
        <div className="w-full max-w-7xl mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isFullscreen ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-gray-700">
                  {isFullscreen ? 'Secure Mode: Active' : 'Secure Mode: Inactive'}
                </span>
              </div>
              
              {/* Warning Timer Display */}
              {warningTimerActive && (
                <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full border border-red-300">
                  <FaClock className="text-red-600 text-xs" />
                  <span className="text-sm font-bold text-red-600">
                    {formatWarningTime(warningTimer)}
                  </span>
                  <span className="text-xs text-red-600">until termination</span>
                </div>
              )}
              
              {fullscreenExitCount > 0 && (
                <div className="flex items-center gap-2 text-orange-600">
                  <span className="text-xs">⚠️ Security Violations: {fullscreenExitCount}</span>
                </div>
              )}
              
              {/* Recording Status Indicator */}
              {recordingState.isRecording && (
                <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full border border-red-300">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-red-700">
                    REC {Math.floor(recordingState.duration / 60)}:{String(recordingState.duration % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
              
              {/* Upload Progress Indicator */}
              {isUploading && (
                <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full border border-blue-300">
                  <FaUpload className="text-blue-600 text-xs animate-bounce" />
                  <span className="text-sm font-medium text-blue-700">
                    Uploading {uploadProgress}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <Button
                  onClick={() => {
                    setWarningTimerActive(false);
                    setWarningTimer(180);
                    enterFullscreen();
                  }}
                  size="sm"
                  variant="outline"
                  className={`text-xs flex items-center gap-1 ${warningTimerActive ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : ''}`}
                >
                  <FaExpand />
                  {warningTimerActive ? 'Return to Secure Mode' : 'Enter Fullscreen'}
                </Button>
              )}
              <Button
                onClick={endInterview}
                size="sm"
                variant="outline"
                className="text-xs text-red-600 hover:text-red-700"
              >
                End Interview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="w-full max-w-7xl flex-1 flex flex-col justify-center items-center">
        <div className="flex w-full max-w-7xl gap-6 mb-6 items-center justify-center">
          {/* Left: Camera feed */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-lg p-0 overflow-hidden flex items-center justify-center min-h-[540px] max-w-[48%] relative" style={{height: '540px'}}>
            {cameraStream ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📹</span>
                  </div>
                  <p className="text-lg text-gray-500 mb-2">Camera Loading...</p>
                  <p className="text-sm text-gray-400">Please allow camera access when prompted</p>
                </div>
              </div>
            )}
            
            {/* Microphone controls */}
            {interviewStarted && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold shadow border-2 transition ${
                    micMuted
                      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                  }`}
                  onClick={() => setMicMuted(!micMuted)}
                >
                  {micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                  {micMuted ? 'Unmute' : 'Mute'}
                </button>
                {conversation.isSpeaking && (
                  <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold shadow border border-blue-200">
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-blue-500 animate-pulse" />
                      <div className="w-1 h-3 bg-blue-500 animate-pulse delay-100" />
                      <div className="w-1 h-3 bg-blue-500 animate-pulse delay-200" />
                    </div>
                    AI Speaking
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right: AI Avatar video */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-lg p-0 overflow-hidden flex items-center justify-center min-h-[540px] max-w-[48%] relative" style={{ height: '540px' }}>
            {/* AI Avatar Video Area */}
            <Card className="h-full">
              <CardContent className="p-0 h-full relative bg-gradient-to-br from-blue-900 to-purple-900">
                {/* Video element */}
                <video 
                  ref={aiVideoRef}
                  className="w-full h-full object-cover rounded-lg"
                  playsInline
                  muted
                  loop
                  style={{ display: 'block' }}
                >
                  <source src="/ai-avatar.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Fallback content for when video fails */}
                <div 
                  id="ai-avatar-fallback"
                  className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-900 flex flex-col items-center justify-center text-white rounded-lg"
                  style={{ display: 'none' }}
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-2xl">🤖</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">AI Interviewer</h3>
                  <p className="text-sm text-white/80 text-center max-w-48">
                    {interviewStarted ? 'Interview in progress...' : 'Ready to interview'}
                  </p>
                </div>
                
                {/* Video status overlay */}
                <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                  Video Status: <span id="video-status">Loading...</span>
                </div>
                
                {/* Interview status overlay */}
                {!interviewStarted && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🎯</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Ready to Start</h3>
                      <p className="text-sm text-white/80">Click "Start Interview" to begin</p>
                    </div>
                  </div>
                )}
                
                {/* AI Speaking status overlay */}
                {interviewStarted && !conversation.isSpeaking && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">AI Interviewer</h3>
                      <p className="text-sm text-white/80">Listening to your response...</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Video debug info (only in development) */}
            {interviewStarted && aiVideoRef.current && (
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
                Video: {aiVideoRef.current.readyState >= 2 ? 'Ready' : 'Loading...'}
              </div>
            )}
            
            {/* Volume control */}
            {interviewStarted && (
              <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-3 rounded-lg shadow">
                <div className="flex items-center gap-2 text-sm">
                  <span>Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20"
                  />
                  <span>{Math.round(volume * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Bottom: Transcript */}
        <div className="w-full max-w-7xl bg-white rounded-2xl shadow-lg p-6 mb-4 min-h-[200px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Current Conversation</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className={`w-2 h-2 rounded-full ${conversation.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
              {conversation.status}
            </div>
          </div>
          <div className="space-y-3">
            {transcript.length === 0 && !interviewStarted && (
              <div className="text-center text-gray-500 py-8">Start the interview to see the current conversation</div>
            )}
            {interviewStarted && transcript.length === 0 && (
              <div className="text-center text-gray-500 py-8">Waiting for conversation...</div>
            )}
            {transcript.slice(-2).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  entry.speaker === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>{entry.speaker === 'agent' ? 'AI' : 'You'}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{entry.text}</p>
                  <span className="text-xs text-gray-500">{entry.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {currentTranscript && (
              <div className="flex items-start gap-3 opacity-60">
                <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">You</span>
                <p className="text-sm text-gray-700 italic">{currentTranscript}...</p>
              </div>
            )}
          </div>
        </div>
        {/* Start / End buttons */}
        {!interviewStarted ? (
          <div className="w-full flex justify-center mt-8">
            <Button 
              onClick={startInterview} 
              className="px-10 py-4 text-xl font-bold rounded-xl shadow bg-blue-700 hover:bg-blue-800 text-white"
            >
              Start Interview
            </Button>
          </div>
        ) : (
          <div className="w-full flex justify-center mt-4">
            <Button onClick={endInterview} variant="destructive" className="px-8 py-3 text-lg font-semibold rounded-xl">
              End Interview
            </Button>
          </div>
        )}
      </div>
      {/* Completion Dialog */}
      <Dialog open={showCompleted || analysisRunning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{analysisRunning ? 'Analysing Interview…' : 'Interview Completed!'}</DialogTitle>
          </DialogHeader>
          {analysisRunning ? (
            <p className="text-gray-600">Running AI evaluation of your responses, please wait…</p>
          ) : (
            <p className="text-gray-600">Redirecting to your results…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoInterview;
