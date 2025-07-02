import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { InterviewService } from '@/lib/services/interviewService';

interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: Date;
  isFinal?: boolean;
}

interface UseInterviewTranscriptReturn {
  transcript: string;
  transcriptEntries: TranscriptEntry[];
  isStoring: boolean;
  isRetrieving: boolean;
  storeTranscript: (sessionId: string, metadata: any) => Promise<any>;
  retrieveTranscript: (sessionId: string) => Promise<any>;
  reanalyzeTranscript: (sessionId: string, reason?: string) => Promise<any>;
}

export function useInterviewTranscript(
  transcript: string,
  transcriptEntries: TranscriptEntry[]
): UseInterviewTranscriptReturn {
  const [isStoring, setIsStoring] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const { toast } = useToast();

  const storeTranscript = useCallback(async (sessionId: string, metadata: {
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
    cheatingFlags: string[];
    fullscreenExitCount: number;
  }) => {
    setIsStoring(true);
    try {
      const result = await InterviewService.completeInterviewWithTranscript(
        sessionId,
        transcript,
        transcriptEntries,
        metadata.startedAt,
        metadata.endedAt,
        metadata.durationSeconds,
        metadata.cheatingFlags,
        metadata.fullscreenExitCount
      );
      
      toast({
        title: "Transcript Stored",
        description: "Interview transcript has been saved to the database.",
      });
      
      return result;
    } catch (error) {
      console.error('Error storing transcript:', error);
      toast({
        title: "Storage Error",
        description: "Failed to store interview transcript.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsStoring(false);
    }
  }, [transcript, transcriptEntries, toast]);

  const retrieveTranscript = useCallback(async (sessionId: string) => {
    setIsRetrieving(true);
    try {
      const result = await InterviewService.getStoredTranscript(sessionId);
      
      toast({
        title: "Transcript Retrieved",
        description: "Interview transcript loaded from database.",
      });
      
      return result;
    } catch (error) {
      console.error('Error retrieving transcript:', error);
      toast({
        title: "Retrieval Error",
        description: "Failed to retrieve interview transcript.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsRetrieving(false);
    }
  }, [toast]);

  const reanalyzeTranscript = useCallback(async (sessionId: string, reason?: string) => {
    try {
      const result = await InterviewService.analyzeStoredTranscript(sessionId, reason);
      
      toast({
        title: "Re-analysis Complete",
        description: "Interview transcript has been re-analyzed successfully.",
      });
      
      return result;
    } catch (error) {
      console.error('Error re-analyzing transcript:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to re-analyze interview transcript.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  return {
    transcript,
    transcriptEntries,
    isStoring,
    isRetrieving,
    storeTranscript,
    retrieveTranscript,
    reanalyzeTranscript,
  };
} 