import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { FaMicrophone, FaClock, FaMicrophoneSlash, FaExpand, FaCompress } from 'react-icons/fa';
import { useConversation } from '@11labs/react';
import { InterviewService } from '../lib/services';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';

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
  const [isConversationReady, setIsConversationReady] = useState(false);
  
  // Fullscreen and anti-cheating state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [cheatingFlags, setCheatingFlags] = useState<string[]>([]);
  const [warningTimer, setWarningTimer] = useState(180); // 3 minutes in seconds
  const [warningTimerActive, setWarningTimerActive] = useState(false);
  
  // Add state for managing autoplay permissions and user interaction
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [videoCanAutoplay, setVideoCanAutoplay] = useState(false);
  const [autoplaySupported, setAutoplaySupported] = useState('unknown');
  
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
      video.muted = true; // Always muted for autoplay compliance
      video.loop = true;
      video.playsInline = true;
      video.autoplay = false; // Don't use HTML autoplay attribute
      video.currentTime = 0; // Start from beginning
      
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
        // Ensure video is paused and ready
        video.pause();
        video.currentTime = 0;
        updateVideoStatus('Ready for sync');
      });
      video.addEventListener('canplay', () => {
        console.log('AI Video: Can play');
        updateVideoStatus('Ready');
        // Ensure video is paused and ready
        video.pause();
        video.currentTime = 0;
      });
      video.addEventListener('canplaythrough', () => {
        console.log('AI Video: Can play through');
        updateVideoStatus('Ready to play');
        // Ensure video is paused and ready
        video.pause();
        video.currentTime = 0;
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
          const aiAvatarVideoUrl = 'https://pdf1.blob.core.windows.net/pdf/0426.mp4';
          
          console.log('🎬 Loading AI Avatar video from Azure Blob Storage...');
          updateVideoStatus('Loading AI Avatar...');
          
          // Test video accessibility first
          const response = await fetch(aiAvatarVideoUrl, { method: 'HEAD' });
          console.log('🌐 Video accessibility check:', response.status, response.statusText);
          
          if (response.ok) {
            // Set the video source directly to the blob URL
            video.src = aiAvatarVideoUrl;
            video.load();
            
            console.log('✅ Video source set to:', aiAvatarVideoUrl);
            
            // Add a listener to confirm when video is ready
            video.addEventListener('loadeddata', () => {
              console.log('🎬 Video data loaded - ready for synchronization');
              updateVideoStatus('Ready for sync');
            }, { once: true });
            
          } else {
            throw new Error(`Video not accessible: ${response.status}`);
          }
          
        } catch (error) {
          console.error('❌ Failed to set up video:', error);
          updateVideoStatus('Setup failed');
          
          // Try fallback with local video
          console.log('🔄 Trying fallback local video...');
          video.src = '/ai-avatar.mp4';
          video.load();
          
          video.addEventListener('error', () => {
            // Show fallback content if both sources fail
            const fallback = document.getElementById('ai-avatar-fallback');
            if (fallback) {
              fallback.style.display = 'flex';
              video.style.display = 'none';
            }
          }, { once: true });
        }
      };
      
      tryLoadVideo();
    }
  }, []);

  // Control AI avatar video state when interview ends
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
    
    // Check autoplay policy support
    checkAutoplaySupport();
    
    // Add global click listener to detect user interaction
    const handleUserInteraction = () => {
      console.log('👆 User interaction detected - enabling video autoplay');
      setHasUserInteracted(true);
      
      // Remove listener after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Function to check autoplay policy
  const checkAutoplaySupport = async () => {
    try {
      if ('getAutoplayPolicy' in navigator) {
        const policy = (navigator as any).getAutoplayPolicy('mediaelement');
        console.log('🎬 Autoplay policy:', policy);
        setAutoplaySupported(policy);
        setVideoCanAutoplay(policy === 'allowed' || policy === 'allowed-muted');
      } else {
        console.log('🎬 getAutoplayPolicy not supported, testing with video element');
        await testVideoAutoplay();
      }
    } catch (error) {
      console.error('❌ Error checking autoplay support:', error);
      setAutoplaySupported('disallowed');
      setVideoCanAutoplay(false);
    }
  };

  // Fallback autoplay test
  const testVideoAutoplay = async () => {
    try {
      const testVideo = document.createElement('video');
      testVideo.muted = true;
      testVideo.autoplay = true;
      testVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzFtcDQxAAAACGZyZWUAAAAAAAAAAmEbEwAACXxtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjc0OCA5OTE4MDk2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNiAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAASGWIhAA3//72hEfLgAACALAY/////g==';
      
      const playPromise = testVideo.play();
      if (playPromise) {
        await playPromise;
        console.log('✅ Video autoplay test passed');
        setAutoplaySupported('allowed-muted');
        setVideoCanAutoplay(true);
      }
    } catch (error) {
      console.log('❌ Video autoplay test failed:', error);
      setAutoplaySupported('disallowed');
      setVideoCanAutoplay(false);
    }
  };

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
    setIsConversationReady(true);
    
    // Ensure video is paused on initial connection
    if (aiVideoRef.current) {
      aiVideoRef.current.pause();
      aiVideoRef.current.currentTime = 0;
    }
  },
    
      onDisconnect: () => {
    console.log('Disconnected from ElevenLabs');
    setIsConversationReady(false);
  },
    
    onMessage: (message) => {
      handleMessage(message);
    },
    
    onError: (error) => {
      console.error('Conversation error:', error);
      setError('An error occurred with the AI interviewer. Please check your connection and try again.');
    },
    
      onModeChange: (mode) => {
    console.log('🎤 ElevenLabs Mode changed:', mode);
    console.log('🎯 Current states:', { 
      interviewStarted, 
      isConversationReady, 
      hasUserInteracted,
      videoCanAutoplay,
      autoplaySupported,
      videoReadyState: aiVideoRef.current?.readyState,
      videoSrc: aiVideoRef.current?.src 
    });
    
    // Update agent status in UI immediately
    const agentStatusElement = document.getElementById('agent-status');
    if (agentStatusElement) {
      agentStatusElement.textContent = mode.mode === 'speaking' ? 'speaking' : 'listening';
      console.log(`📱 Updated UI status to: ${mode.mode}`);
    }
    
    // Control AI avatar video based on speaking mode
    if (aiVideoRef.current && interviewStarted) {
      const video = aiVideoRef.current;
      
      if (mode.mode === 'speaking') {
        // ElevenLabs is speaking - attempt to play the video
        console.log('🗣️ AI is speaking - attempting to play video');
        
        // Check if we can play the video
        const canPlayVideo = hasUserInteracted || videoCanAutoplay || autoplaySupported === 'allowed-muted';
        
        if (canPlayVideo) {
          const playVideo = async () => {
            try {
              // Ensure video properties for autoplay compliance
              video.muted = true;
              video.loop = true;
              
              console.log('🎬 Video play attempt - readyState:', video.readyState);
              console.log('🎬 Video src:', video.src);
              console.log('🎬 Video duration:', video.duration);
              console.log('🎬 Can play video:', canPlayVideo);
              
              await video.play();
              console.log('✅ Video is now playing!');
              
              // Visual feedback
              video.style.opacity = '1';
              
            } catch (err) {
              console.error('❌ Failed to play video during speaking:', err);
              
              // Show user interaction prompt if needed
              if (!hasUserInteracted) {
                console.log('💡 Video autoplay blocked - user interaction required');
                showUserInteractionPrompt();
              }
              
              // Try to reload video source if needed
              if (!video.src || video.src.includes('blob:')) {
                console.log('🔄 Attempting to reload video source...');
                video.src = 'https://pdf1.blob.core.windows.net/pdf/0426.mp4';
                video.load();
                
                video.addEventListener('canplay', () => {
                  if (hasUserInteracted) {
                    video.play().catch(retryErr => {
                      console.error('❌ Retry play failed:', retryErr);
                    });
                  }
                }, { once: true });
              }
            }
          };
          
          // Call play function
          playVideo();
        } else {
          console.log('⚠️ Cannot play video - no user interaction or autoplay permission');
          showUserInteractionPrompt();
        }
        
      } else if (mode.mode === 'listening') {
        // ElevenLabs is listening - pause the video
        console.log('👂 AI is listening - pausing video');
        video.pause();
        console.log('⏸️ Video paused');
        
        // Visual feedback
        video.style.opacity = '0.8';
      }
    } else {
      console.log('⚠️ Cannot control video:', {
        hasVideoRef: !!aiVideoRef.current,
        interviewStarted
      });
    }
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
          fetch(`https://backendb2b.azurewebsites.net/api/interviews/${sessionData.session_id}/update-conversation`, {
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

  // Camera access (VIDEO ONLY - no audio to prevent feedback)
  useEffect(() => {
    if (!interviewStarted) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => setCameraStream(stream))
      .catch((err) => console.error('Camera error:', err));
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line
  }, [interviewStarted]);

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

  // Function to show user interaction prompt for video autoplay
  const showUserInteractionPrompt = () => {
    const promptElement = document.getElementById('video-interaction-prompt');
    if (promptElement) {
      promptElement.style.display = 'flex';
      console.log('📱 Showing user interaction prompt for video');
    }
  };

  // Function to enable video after user interaction
  const enableVideoAutoplay = () => {
    console.log('✅ User enabled video autoplay');
    setHasUserInteracted(true);
    
    // Hide the prompt
    const promptElement = document.getElementById('video-interaction-prompt');
    if (promptElement) {
      promptElement.style.display = 'none';
    }
    
    // If AI is currently speaking, try to play the video
    const agentStatusElement = document.getElementById('agent-status');
    if (agentStatusElement && agentStatusElement.textContent === 'speaking') {
      if (aiVideoRef.current) {
        aiVideoRef.current.play().catch(err => {
          console.error('❌ Failed to play video after user interaction:', err);
        });
      }
    }
    
    toast.success('🎬 Video autoplay enabled!', {
      description: 'The AI avatar will now sync with voice.',
    });
  };

  // Start interview with AI
  const startInterview = async () => {
    try {
      // Request microphone access ONLY for ElevenLabs (separate from camera)
      await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      
      // Enter fullscreen mode for anti-cheating
      await enterFullscreen();
      
      // Get agent ID - hardcoded ElevenLabs agent ID
      const agentId = 'agent_01jw4mdjgvef2rmm7e3kgnsrzp'; // Hardcoded ElevenLabs agent ID
      console.log('Using ElevenLabs Agent ID:', agentId);
      
      let sessionResponse: any;
      
      // Try to get signed URL from backend first, then fallback to direct agent ID
      try {
        const response = await fetch(`/api/elevenlabs/signed-url?agentId=${agentId}`);
        
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
      
      // Show autoplay info if needed
      if (!hasUserInteracted && (autoplaySupported === 'disallowed' || autoplaySupported === 'unknown')) {
        setTimeout(() => {
          toast.info('🎬 Video Avatar Sync', {
            description: 'Click "Enable Video Sync" when prompted to see the AI avatar animate with speech.',
          });
        }, 2000);
      }
      
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
      
      // Trigger backend analysis if we have a session id
      if (sessionData?.session_id) {
        setAnalysisRunning(true);
        toast.info('Interview completed – analyzing your responses...');
        
        try {
          // Filter out duplicate messages from transcript
          const filteredTranscript = transcript.filter((entry, index, arr) => {
            // Check if this exact message appears earlier in the array
            const firstIndex = arr.findIndex(e => 
              e.speaker === entry.speaker && 
              e.text === entry.text
            );
            // Keep only the first occurrence
            return firstIndex === index;
          });
          
          // Convert transcript to text format
          const transcriptText = filteredTranscript
            .map(entry => `${entry.speaker === 'agent' ? 'AI' : 'USER'}: ${entry.text}`)
            .join('\n');
          
          console.log('Sending transcript for analysis:', {
            totalMessages: transcript.length,
            filteredMessages: filteredTranscript.length,
            duplicatesRemoved: transcript.length - filteredTranscript.length
          });
          
          // Calculate interview duration
          const startTime = filteredTranscript[0]?.timestamp || new Date();
          const endTime = filteredTranscript[filteredTranscript.length - 1]?.timestamp || new Date();
          const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          
          // Send transcript directly to backend
          const response = await fetch(`https://backendb2b.azurewebsites.net/api/interviews/${sessionData.session_id}/complete-with-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: transcriptText,
              transcript_entries: filteredTranscript,
              started_at: startTime.toISOString(),
              ended_at: endTime.toISOString(),
              duration_seconds: durationSeconds,
              cheating_flags: cheatingFlags,
              fullscreen_exit_count: fullscreenExitCount
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze interview');
          }
          
          const analysisResult = await response.json();
          
          // Log security violations if any
          if (cheatingFlags.length > 0) {
            console.warn('Security violations detected:', cheatingFlags);
            toast.warning(`⚠️ ${cheatingFlags.length} security violation(s) recorded during interview`, {
              description: 'These have been included in your interview report.',
            });
          }
          
          toast.success('Interview analysis completed successfully!', {
            description: 'Redirecting to your results...',
          });
          
          // Store the analysis result ID if available
          const resultId = analysisResult?.data?.id || sessionData.session_id;
          
          // Redirect to results page with a slight delay
          setTimeout(() => {
            navigate(`/interview-results?session=${resultId}`);
          }, 2000);
          
        } catch (err) {
          console.error('Analysis error:', err);
          
          toast.error('Failed to analyze interview', {
            description: 'Please contact support if the issue persists.',
          });
          
          // Still redirect but with a longer delay
          setTimeout(() => {
            navigate(`/interview-results?session=${sessionData.session_id}`);
          }, 3000);
        } finally {
          setAnalysisRunning(false);
          setShowCompleted(true);
        }
      } else {
        // No session data - just end the interview
        toast.info('Interview ended');
      }
    } catch (err) {
      console.error('Error ending conversation:', err);
      toast.error('Error ending interview', {
        description: 'Please contact support if the issue persists.',
      });
    }
    
    // Reset state
    setInterviewStarted(false);
    setTranscript([]);
    setCurrentTranscript('');
    setConversationId(null);
    setIsConversationReady(false);
    
    // Reset anti-cheating counters
    setFullscreenExitCount(0);
    setCheatingFlags([]);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-7xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-10 w-10" />
          <span className="text-3xl font-bold text-[#2a3990] tracking-tight">JOB SPRING</span>
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
            {interviewStarted ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">Camera preview</div>
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
                  autoPlay={false}
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
                  Video: <span id="video-status">Loading...</span>
                  {interviewStarted && (
                    <span className="ml-2">
                      | Conv: {isConversationReady ? '✅' : '⏳'}
                      | Auto: {hasUserInteracted ? '✅' : (autoplaySupported === 'allowed' || autoplaySupported === 'allowed-muted') ? '🔇' : '❌'}
                    </span>
                  )}
                </div>
                
                {/* Agent status indicator */}
                {interviewStarted && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                    <div className={`w-3 h-3 rounded-full animate-pulse`} style={{
                      backgroundColor: '#10b981'
                    }}></div>
                    <span id="agent-status" className="text-sm text-white">
                      listening
                    </span>
                  </div>
                )}
                
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
                
                {/* User interaction prompt for video autoplay */}
                <div 
                  id="video-interaction-prompt"
                  className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg"
                  style={{ display: 'none' }}
                >
                  <div className="text-center text-white max-w-sm mx-auto p-6">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🎬</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Enable Video Sync</h3>
                    <p className="text-sm text-white/80 mb-4">
                      To see the AI avatar animated with speech, please allow video autoplay
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={enableVideoAutoplay}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Enable Video Sync
                      </button>
                      <button
                        onClick={() => {
                          const promptElement = document.getElementById('video-interaction-prompt');
                          if (promptElement) promptElement.style.display = 'none';
                        }}
                        className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Continue without Video
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mt-3">
                      This is required due to browser autoplay policies
                    </p>
                  </div>
                </div>
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
              <div className="flex gap-2 ml-4">
                <Button onClick={addTestTranscript} variant="outline" size="sm" className="text-xs">
                Test Transcript
              </Button>
                <Button 
                  onClick={async () => {
                    if (aiVideoRef.current) {
                      const video = aiVideoRef.current;
                      console.log('🧪 Manual video test initiated');
                      console.log('Video element:', video);
                      console.log('Video src:', video.src);
                      console.log('Video readyState:', video.readyState);
                      console.log('Video networkState:', video.networkState);
                      
                      try {
                        // Test video accessibility from Azure Blob Storage
                        const blobUrl = 'https://pdf1.blob.core.windows.net/pdf/0426.mp4';
                        console.log('Testing Azure Blob Storage video:', blobUrl);
                        
                        const response = await fetch(blobUrl, { method: 'HEAD' });
                        console.log('✅ Video accessibility test:', response.status, response.statusText);
                        console.log('Content-Type:', response.headers.get('content-type'));
                        console.log('Content-Length:', response.headers.get('content-length'));
                        
                        // Set video source and try to play
                        video.src = blobUrl;
                        video.muted = true;
                        await video.play();
                        console.log('✅ Manual video play successful from Azure Blob Storage');
                      } catch (error) {
                        console.error('❌ Manual video test failed:', error);
                      }
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
                >
                  Test Video
                </Button>
                <Button 
                  onClick={() => {
                    // Manually trigger speaking mode for testing
                    console.log('🧪 Manual speaking mode test');
                    const agentStatusElement = document.getElementById('agent-status');
                    if (agentStatusElement) {
                      agentStatusElement.textContent = 'speaking';
                    }
                    
                    if (aiVideoRef.current) {
                      const video = aiVideoRef.current;
                      video.muted = true;
                      video.loop = true;
                      video.play().then(() => {
                        console.log('✅ Manual speaking mode - video playing');
                        video.style.opacity = '1';
                        
                        // Auto switch back to listening after 3 seconds
                        setTimeout(() => {
                          video.pause();
                          video.style.opacity = '0.8';
                          if (agentStatusElement) {
                            agentStatusElement.textContent = 'listening';
                          }
                          console.log('⏸️ Manual test - switched back to listening');
                        }, 3000);
                      }).catch(err => {
                        console.error('❌ Manual speaking mode failed:', err);
                        showUserInteractionPrompt();
                      });
                    }
                  }}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
                >
                  Test Sync
                </Button>
                <Button 
                  onClick={() => {
                    console.log('🧪 Testing autoplay prompt');
                    showUserInteractionPrompt();
                  }}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md transition-colors"
                >
                  Test Prompt
                </Button>
              </div>
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
            <Button onClick={startInterview} className="px-10 py-4 text-xl font-bold rounded-xl shadow bg-blue-700 hover:bg-blue-800 text-white">
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
