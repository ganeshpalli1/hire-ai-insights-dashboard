import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '../components/ui/use-toast';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FaUpload, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { azureBlobService } from '../lib/services/azureBlobService';
import { screenRecorder } from '../lib/services/screenRecordingService';

interface LocationState {
  recordingBlob: Blob;
  sessionData: any;
  recordingDuration: number;
  transcript: any[];
  cheatingFlags: any[];
  fullscreenExitCount: number;
}

export const UploadProgress: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'analyzing' | 'complete' | 'error'>('uploading');
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    const state = location.state as LocationState;
    
    if (!state?.recordingBlob || !state?.sessionData) {
      toast.error('No recording data found');
      navigate('/dashboard');
      return;
    }
    
    handleUploadAndAnalysis(state);
  }, []);
  
  const handleUploadAndAnalysis = async (state: LocationState) => {
    const { recordingBlob, sessionData, recordingDuration, transcript, cheatingFlags, fullscreenExitCount } = state;
    
    try {
      // Step 1: Upload to Azure
      setUploadStatus('uploading');
      console.log(`📁 Recording size: ${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      const metadata = {
        interviewId: sessionData.session_id,
        sessionId: sessionData.session_id,
        candidateName: sessionData.candidate_name,
        jobTitle: sessionData.job_title || 'Unknown Position',
        recordingDate: new Date().toISOString(),
        fileSize: `${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`,
        duration: `${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`
      };
      
      const uploadResult = await azureBlobService.uploadLargeRecording(
        recordingBlob,
        metadata,
        (progress) => {
          setUploadProgress(progress.percentage);
          console.log(`📤 Upload progress: ${progress.percentage}%`);
        }
      );
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }
      
      console.log('✅ Recording uploaded successfully:', uploadResult.blobUrl);
      
      // Step 2: Process and analyze
      setUploadStatus('processing');
      setUploadProgress(100);
      
      // Filter out duplicate messages from transcript
      const filteredTranscript = transcript.filter((entry, index, arr) => {
        const firstIndex = arr.findIndex(e => 
          e.speaker === entry.speaker && 
          e.text === entry.text
        );
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
      
      setUploadStatus('analyzing');
      
      // Send transcript to backend for analysis
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net';
      const response = await fetch(`${apiBaseUrl}/api/interviews/${sessionData.session_id}/complete-with-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          transcript_entries: filteredTranscript,
          started_at: startTime.toISOString(),
          ended_at: endTime.toISOString(),
          duration_seconds: durationSeconds,
          cheating_flags: cheatingFlags,
          fullscreen_exit_count: fullscreenExitCount,
          recording_url: uploadResult.blobUrl
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
      }
      
      setUploadStatus('complete');
      
      // Redirect to results page
      setTimeout(() => {
        const resultId = analysisResult?.data?.id || sessionData.session_id;
        navigate(`/interview-results?session=${resultId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error in upload/analysis process:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      
      // Still redirect to results after error
      setTimeout(() => {
        navigate(`/interview-results?session=${sessionData.session_id}`);
      }, 3000);
    }
  };
  
  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading your interview recording...';
      case 'processing':
        return 'Processing your recording...';
      case 'analyzing':
        return 'Analyzing your interview responses...';
      case 'complete':
        return 'Interview analysis complete!';
      case 'error':
        return 'An error occurred';
      default:
        return '';
    }
  };
  
  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <FaUpload className="text-blue-600 text-4xl animate-bounce" />;
      case 'processing':
      case 'analyzing':
        return <FaSpinner className="text-blue-600 text-4xl animate-spin" />;
      case 'complete':
        return <FaCheckCircle className="text-green-600 text-4xl" />;
      case 'error':
        return <div className="text-red-600 text-4xl">⚠️</div>;
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl font-bold">
            {getStatusMessage()}
          </CardTitle>
          <CardDescription>
            {uploadStatus === 'error' 
              ? errorMessage 
              : 'Please wait while we process your interview'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          {uploadStatus === 'uploading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Upload Progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-3" />
              <p className="text-xs text-gray-500 text-center">
                This may take a few moments depending on your connection speed
              </p>
            </div>
          )}
          
          {/* Processing Animation */}
          {(uploadStatus === 'processing' || uploadStatus === 'analyzing') && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
                  <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {uploadStatus === 'processing' 
                  ? 'Finalizing your recording...' 
                  : 'Our AI is analyzing your responses...'
                }
              </p>
            </div>
          )}
          
          {/* Success Message */}
          {uploadStatus === 'complete' && (
            <div className="text-center space-y-2">
              <p className="text-green-600 font-medium">
                Your interview has been successfully processed!
              </p>
              <p className="text-sm text-gray-600">
                Redirecting to your results...
              </p>
            </div>
          )}
          
          {/* Error Message */}
          {uploadStatus === 'error' && (
            <div className="text-center space-y-2">
              <p className="text-red-600 text-sm">
                {errorMessage}
              </p>
              <p className="text-xs text-gray-600">
                Don't worry, your interview data has been saved. Redirecting to results...
              </p>
            </div>
          )}
          
          {/* Info Cards */}
          <div className="space-y-3 mt-6">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>🔒 Secure Upload:</strong> Your interview recording is being securely uploaded to our encrypted storage.
              </p>
            </div>
            
            {uploadStatus === 'analyzing' && (
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                <p className="text-xs text-indigo-800">
                  <strong>🤖 AI Analysis:</strong> Our AI is evaluating your responses, communication skills, and technical knowledge.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 