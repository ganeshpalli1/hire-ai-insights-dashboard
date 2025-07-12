import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { AlertTriangle, CheckCircle, Shield, Eye, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { screenRecorder } from '../lib/services/screenRecordingService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export const InterviewInstructions: React.FC = () => {
  const [isAgreed, setIsAgreed] = useState(false);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isNavigatingToInterview, setIsNavigatingToInterview] = useState(false);
  const [showAudioWarning, setShowAudioWarning] = useState(false);
  const [hasSystemAudioStored, setHasSystemAudioStored] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Use ref to track navigation status to avoid stale closure issues
  const isNavigatingRef = useRef(false);

  // Update ref when navigation status changes
  useEffect(() => {
    isNavigatingRef.current = isNavigatingToInterview;
  }, [isNavigatingToInterview]);

  // Cleanup effect - stop recording if user navigates away without proceeding
  useEffect(() => {
    console.log('🔧 Setting up cleanup effect for InterviewInstructions');
    
    return () => {
      console.log('🧹 InterviewInstructions cleanup running...');
      console.log('📊 Cleanup state:', {
        isNavigatingRef: isNavigatingRef.current,
        recordingState: screenRecorder.getState().isRecording
      });
      
      // Check the ref value instead of state to get the latest value
      if (!isNavigatingRef.current) {
        console.log('🛑 User navigated away without proceeding to interview');
        const state = screenRecorder.getState();
        if (state.isRecording) {
          console.log('⏹️ Stopping screen recording...');
          screenRecorder.stopRecording();
        }
      } else {
        console.log('✅ Navigating to interview - keeping recording active');
      }
    };
  }, []); // Empty dependency array - cleanup only runs on unmount

  // Debug effect to log state changes
  useEffect(() => {
    console.log('📊 State Update:', {
      permissionsGranted,
      hasSystemAudioStored,
      showAudioWarning,
      isRequestingPermissions
    });
  }, [permissionsGranted, hasSystemAudioStored, showAudioWarning, isRequestingPermissions]);



  const requestAllPermissions = async () => {
    try {
      setIsRequestingPermissions(true);
      console.log('🔐 Requesting all permissions...');
      
      // Step 1: Request camera permission
      console.log('📸 Requesting camera access...');
      const cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false // Camera only, no audio to avoid echo
      });
      
      // Store camera stream in sessionStorage to pass to VideoInterview
      (window as any).cameraStream = cameraStream;
      console.log('✅ Camera access granted');
      
      // Step 2: Request microphone permission for ElevenLabs
      console.log('🎤 Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('✅ Microphone access granted');
      
      // Step 3: Request screen sharing permission with clear audio instructions
      console.log('🖥️ Requesting screen sharing permission...');
      
      // Show detailed instructions about system audio BEFORE the permission dialog
      toast.info('🎤 IMPORTANT: Screen Sharing + Audio Permission', {
        description: '🔊 In the next dialog, please:\n1. Select your screen/window\n2. ✅ CHECK the "Share audio" box\n3. Click "Share" to continue',
        duration: 8000
      });
      
      // Wait a moment for user to read the instructions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Import the screen recorder service
      const { screenRecorder } = await import('../lib/services/screenRecordingService');
      
      // Initialize screen recording
      const recordingSupported = await screenRecorder.initializeRecording();
      if (!recordingSupported) {
        throw new Error('Screen recording not supported');
      }
      
      // Start recording (this will show permission dialog with "Share audio" checkbox)
      const recordingStarted = await screenRecorder.startRecording();
      
      if (!recordingStarted) {
        throw new Error('Screen recording permission denied');
      }
      
      // Wait a bit for stream to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if system audio was captured
      const screenStream = (screenRecorder as any).screenStream;
      const hasSystemAudio = screenStream && screenStream.getAudioTracks().length > 0;
      
      // Debug logging
      console.log('🔍 Debug - Screen Stream Analysis:');
      console.log(`- Stream exists: ${screenStream ? 'YES' : 'NO'}`);
      if (screenStream) {
        console.log(`- Video tracks: ${screenStream.getVideoTracks().length}`);
        console.log(`- Audio tracks: ${screenStream.getAudioTracks().length}`);
        const audioTracks = screenStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach((track: MediaStreamTrack, index: number) => {
            console.log(`  Audio Track ${index}: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
          });
        }
      }
      
      // Keep the recording active - don't stop it!
      console.log('✅ Screen recording permission granted and kept active');
      console.log(`🔊 System audio captured: ${hasSystemAudio ? 'YES' : 'NO'}`);
      
      // Store the audio state immediately
      setHasSystemAudioStored(hasSystemAudio);
      
      if (!hasSystemAudio) {
        // Permissions granted but no audio
        setPermissionsGranted(true);
        setIsRequestingPermissions(false);
        // Show the big warning dialog for missing audio
        setShowAudioWarning(true);
        console.warn('⚠️ System audio not detected - showing warning dialog');
        // Don't return true if audio is missing
        return false;
      } else {
        // All permissions granted successfully with audio
        setPermissionsGranted(true);
        setIsRequestingPermissions(false);
        
        // Audio was captured successfully
        toast.success('✅ All permissions granted successfully!', {
          description: '🎤 System audio enabled! Proceeding to interview...',
          duration: 3000
        });
        return true;
      }
      
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      
      let errorMessage = 'Failed to grant required permissions. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow all permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Camera or microphone not found. Please check your devices.';
      } else if (error.message.includes('Screen recording')) {
        errorMessage += 'Screen recording is required. Please allow screen sharing and try again.';
      } else {
        errorMessage += 'Please check your browser settings.';
      }
      
      toast.error('Permission Required', { description: errorMessage });
      setIsRequestingPermissions(false);
      return false;
    }
  };

  const checkSystemAudio = () => {
    // First check if recording is still active
    const recordingState = screenRecorder.getState();
    if (!recordingState.isRecording) {
      console.log('❌ Screen recording is not active');
      return false;
    }
    
    const screenStream = (screenRecorder as any).screenStream;
    const hasSystemAudio = screenStream && screenStream.getAudioTracks().length > 0;
    console.log(`🔊 System audio check: ${hasSystemAudio ? 'PRESENT' : 'MISSING'}`);
    console.log(`📹 Recording active: ${recordingState.isRecording}`);
    console.log(`🎞️ Screen stream exists: ${screenStream ? 'YES' : 'NO'}`);
    if (screenStream) {
      console.log(`🎥 Video tracks: ${screenStream.getVideoTracks().length}`);
      console.log(`🎵 Audio tracks: ${screenStream.getAudioTracks().length}`);
    }
    return hasSystemAudio;
  };

  const proceedToInterview = async () => {
    console.log('✅ Proceeding to interview...');
    console.log('📊 Current state before navigation:', {
      permissionsGranted,
      hasSystemAudioStored,
      recordingActive: screenRecorder.getState().isRecording
    });
    
    setIsRequestingPermissions(false);
    setIsNavigatingToInterview(true);
    
    // Update ref immediately
    isNavigatingRef.current = true;
    
    // Mark recording as persistent to prevent cleanup
    screenRecorder.setPersistRecording(true);
    
    // Small delay to ensure state is set
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get session parameter if it exists
    const sessionId = searchParams.get('session');
    const interviewPath = sessionId ? `/videointerview?session=${sessionId}` : '/videointerview';
    
    // Navigate with a flag indicating permissions are already granted
    navigate(interviewPath, { 
      state: { 
        permissionsGranted: true,
        hasSystemAudio: hasSystemAudioStored 
      } 
    });
  };

  const handleStartInterview = async () => {
    if (!isAgreed) return;
    
    // If permissions not yet granted, request them first
    if (!permissionsGranted) {
      console.log('🔐 Permissions not granted yet, requesting...');
      const granted = await requestAllPermissions();
      
      // If permissions were granted successfully with audio, proceed directly
      if (granted) {
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ All permissions granted with audio, proceeding to interview');
        await proceedToInterview();
      }
      // Otherwise, the audio warning will be shown automatically
      return;
    }
    
    // Check if the audio warning is currently showing
    if (showAudioWarning) {
      console.log('⚠️ Audio warning is showing, cannot proceed');
      return;
    }
    
    // If we have permissions and audio, proceed directly
    if (permissionsGranted && hasSystemAudioStored) {
      // Quick check if recording is still active
      const recordingState = screenRecorder.getState();
      if (!recordingState.isRecording) {
        console.warn('⚠️ Screen recording was stopped - need to request permissions again');
        setPermissionsGranted(false);
        setHasSystemAudioStored(false);
        toast.error('❌ Screen Recording Stopped', {
          description: 'Screen recording was stopped. Please grant permissions again.',
          duration: 5000
        });
        return;
      }
      
      // All good, proceed to interview
      await proceedToInterview();
    }
  };



  const handleAudioWarningRetry = async () => {
    console.log('🔄 Retrying screen sharing with audio...');
    setShowAudioWarning(false);
    setPermissionsGranted(false);
    setHasSystemAudioStored(false);
    
    // Stop current recording to retry
    await screenRecorder.stopRecording();
    
    // Clear the stored camera stream
    if ((window as any).cameraStream) {
      (window as any).cameraStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      delete (window as any).cameraStream;
    }
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Retry permissions
    const granted = await requestAllPermissions();
    
    // If retry was successful with audio, proceed to interview
    if (granted) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ Retry successful with audio, proceeding to interview');
      await proceedToInterview();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
            Before You Begin — Please Read Carefully
          </CardTitle>
          <p className="text-gray-600">
            Please review all guidelines and requirements before starting your interview
          </p>
        </CardHeader>
        
        <CardContent className="space-y-8">
          {/* System & Environment Readiness */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              System & Environment Readiness
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Ensure a stable internet connection. Interruptions may lead to disqualification. May be disqualification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Use a laptop or desktop device with a working webcam and microphone. Mobile phones or tablets are not allowed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Sit in a well-lit, quiet room with minimal background noise or movement.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>A plain background behind them, avoid virtual backgrounds or filters.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Ensure your full face is clearly visible at all times during the interview</span>
              </li>
            </ul>
          </div>

          {/* Strictly Prohibited */}
          <div>
            <h3 className="text-xl font-semibold text-red-600 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Strictly Prohibited During Interview
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 mt-2 flex-shrink-0"></span>
                <span>No other person should be present in the room or assist you at any way.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 mt-2 flex-shrink-0"></span>
                <span>No wear headphones, earbuds or use Bluetooth devices.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 mt-2 flex-shrink-0"></span>
                <span>Read answers from another screen, paper, or mobile device.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 mt-2 flex-shrink-0"></span>
                <span>More than 5 incidents, opening new windows, or minimizing screen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 mt-2 flex-shrink-0"></span>
                <span>Use any AI tools, online search, or assistance software will lead to disqualification.</span>
              </li>
            </ul>
          </div>

          {/* Monitoring & Proctoring */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Monitoring & Proctoring
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">11</span>
                <span>Before You Begin - Immediately - Video, audio, voice, and gaze will be continuously tracked by our AI system.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">12</span>
                <span>Eye movements, background noise, and unusual behavior will be flagged by the system.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">13</span>
                <span>You will receive random prompts (say your name, raise your hand) to verify presence.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">14</span>
                <span>Attempting to manipulate or spoof your identity (deepfake, or pre-recorded video) will lead to immediate rejection.</span>
              </li>
            </ul>
          </div>

          {/* Required Permissions */}
          <div>
            <h3 className="text-xl font-semibold text-blue-600 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Required Permissions
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-800 mb-4 font-medium">
                You'll be asked to grant the following permissions:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">1</span>
                  <div>
                    <p className="font-medium text-blue-800">📸 Camera Access</p>
                    <p className="text-sm text-blue-700">To record your video during the interview</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">2</span>
                  <div>
                    <p className="font-medium text-blue-800">🎤 Microphone Access</p>
                    <p className="text-sm text-blue-700">To record your voice responses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">3</span>
                  <div>
                    <p className="font-medium text-blue-800">🖥️ Screen Recording + Audio</p>
                    <p className="text-sm text-blue-700">To record your screen activity and the AI interviewer's voice</p>
                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                      <p className="text-xs text-yellow-800 font-medium">
                        ⚠️ IMPORTANT: When the screen sharing dialog appears, please:
                      </p>
                      <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                        <li>• Select your screen or browser window</li>
                        <li>• <strong>✅ Check the "Share audio" checkbox</strong></li>
                        <li>• Click "Share" to continue</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Consent & Acknowledgement */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Consent & Acknowledgement
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-4">
                <span className="font-semibold">15.</span> By continuing, you consent to audio/video recording, identity verification, and AI-based monitoring.
              </p>
              
              <div className="flex items-start gap-3 p-4 bg-white rounded-lg border">
                <Checkbox 
                  id="agreement" 
                  checked={isAgreed}
                  onCheckedChange={(checked) => setIsAgreed(checked === true)}
                  className="mt-1"
                />
                <label htmlFor="agreement" className="text-sm text-gray-700 cursor-pointer">
                  I have read and understood the above guidelines. I agree to proceed with full compliance.
                </label>
              </div>
              
              {/* Permission Status */}
              {isAgreed && permissionsGranted && hasSystemAudioStored && !showAudioWarning && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    ✅ All permissions granted including system audio. You're ready to start the interview!
                  </p>
                </div>
              )}
              
              {isAgreed && permissionsGranted && !hasSystemAudioStored && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    ❌ System audio not detected. You must enable "Share audio" to proceed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Start Interview Button */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleStartInterview}
              disabled={!isAgreed || isRequestingPermissions}
              className="px-12 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequestingPermissions 
                ? 'Requesting Permissions...' 
                : permissionsGranted 
                  ? 'Continue to Interview' 
                  : 'Start Interview'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audio Warning Dialog - Cannot be dismissed without retrying */}
      <AlertDialog open={showAudioWarning} onOpenChange={() => {}}>
        <AlertDialogContent className="max-w-2xl" onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-2xl text-red-600">
                🚫 System Audio Required - Cannot Proceed
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-lg font-semibold text-red-800 mb-2">
                  The "Share audio" option must be enabled to start the interview
                </p>
                <p className="text-red-700">
                  System audio is <strong>REQUIRED</strong> to record the AI interviewer's voice. Without it:
                </p>
                <ul className="mt-2 space-y-1 text-red-700">
                  <li>• ❌ The AI's questions won't be recorded</li>
                  <li>• ❌ The interview cannot be properly evaluated</li>
                  <li>• ❌ Your interview will be considered invalid</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">
                  ✅ How to Enable System Audio:
                </p>
                <ol className="text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Click "Retry Screen Sharing with Audio" below</li>
                  <li>In the screen sharing dialog, select your screen</li>
                  <li><strong>CHECK ✓ the "Share audio" checkbox</strong></li>
                  <li>Click "Share" to continue</li>
                </ol>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
                      <AlertDialogFooter>
              <AlertDialogAction 
                onClick={handleAudioWarningRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                🔄 Retry Screen Sharing with Audio
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InterviewInstructions; 