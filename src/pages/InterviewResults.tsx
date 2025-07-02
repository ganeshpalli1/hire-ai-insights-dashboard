import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  PlayIcon, 
  ChatBubbleLeftRightIcon, 
  CheckCircleIcon, 
  ClockIcon,
  ArrowLeftIcon,
  XCircleIcon,
  UserIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useInterviewResults, useInterviewResult } from '../hooks/useInterviewResults';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

export const InterviewResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  
  const { data: jobsWithResults, isLoading, error } = useInterviewResults();
  const { data: selectedResult } = useInterviewResult(selectedResultId || '');

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-green-500 to-green-600 text-white';
    if (score >= 70) return 'from-blue-500 to-blue-600 text-white';
    if (score >= 50) return 'from-orange-500 to-orange-600 text-white';
    return 'from-red-500 to-red-600 text-white';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 50) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (selectedResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Interview Results" 
          subtitle="Detailed candidate evaluation report"
          action={
            <button
              onClick={() => setSelectedResultId(null)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold shadow-sm transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Jobs
            </button>
          }
        />
        
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Candidate Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-8 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                    <UserIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedResult.candidate_name || 'Anonymous Candidate'}
                    </h3>
                    <p className="text-gray-600 text-lg">Interview ID: {selectedResult.interview_session_id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {format(new Date(selectedResult.started_at), 'PPP')}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-2 bg-white p-4 rounded-xl border border-gray-200">
                  <p className="flex items-center">
                    <span className="font-semibold mr-2">Duration:</span>
                    {formatDuration(selectedResult.duration_seconds)}
                  </p>
                  <p className="flex items-center">
                    <span className="font-semibold mr-2">Source:</span>
                    {selectedResult.transcript_source || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Scoring & Evaluation */}
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-6 h-6" />
                  Scoring & Evaluation
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <div className={`text-center p-6 bg-gradient-to-br ${getScoreColor(selectedResult.domain_score)} rounded-2xl shadow-lg`}>
                    <div className="text-3xl font-bold">{selectedResult.domain_score}%</div>
                    <div className="text-sm capitalize font-semibold opacity-90">Domain</div>
                  </div>
                  <div className={`text-center p-6 bg-gradient-to-br ${getScoreColor(selectedResult.behavioral_score)} rounded-2xl shadow-lg`}>
                    <div className="text-3xl font-bold">{selectedResult.behavioral_score}%</div>
                    <div className="text-sm capitalize font-semibold opacity-90">Behavioral</div>
                  </div>
                  <div className={`text-center p-6 bg-gradient-to-br ${getScoreColor(selectedResult.communication_score)} rounded-2xl shadow-lg`}>
                    <div className="text-3xl font-bold">{selectedResult.communication_score}%</div>
                    <div className="text-sm capitalize font-semibold opacity-90">Communication</div>
                  </div>
                  <div className={`text-center p-6 bg-gradient-to-br ${getScoreColor(selectedResult.overall_score)} rounded-2xl shadow-lg`}>
                    <div className="text-3xl font-bold">{selectedResult.overall_score}%</div>
                    <div className="text-sm capitalize font-semibold opacity-90">Overall</div>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl">
                  <p className="text-sm font-bold text-green-800 flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    System Recommendation: {selectedResult.system_recommendation}
                  </p>
                </div>
              </div>

              {/* AI Observations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl border border-purple-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <AcademicCapIcon className="w-6 h-6" />
                    AI Observations
                  </h4>
                  <div className="space-y-4 text-lg">
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Confidence Level:</span>
                      <span className="font-bold">{selectedResult.confidence_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Cheating Detection:</span>
                      <span className={`font-bold ${selectedResult.cheating_detected ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedResult.cheating_detected ? 'Detected' : 'Not Detected'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Body Language:</span>
                      <span className="font-bold">{selectedResult.body_language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Speech Pattern:</span>
                      <span className="font-bold">{selectedResult.speech_pattern}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-2xl border border-orange-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-6 h-6" />
                    Areas of Improvement
                  </h4>
                  <ul className="space-y-4 text-lg">
                    {selectedResult.areas_of_improvement && selectedResult.areas_of_improvement.length > 0 ? (
                      selectedResult.areas_of_improvement.map((improvement, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <span className="w-3 h-3 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-gray-600">{improvement}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500 italic">No specific areas identified</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Security Violations */}
              {selectedResult.security_violations && (
                <div className="bg-gradient-to-br from-red-50 to-pink-50 p-8 rounded-2xl border border-red-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <XCircleIcon className="w-6 h-6" />
                    Security Violations
                  </h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedResult.security_violations, null, 2)}
                  </pre>
                </div>
              )}

              {/* Transcript Preview */}
              {selectedResult.transcript && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl border border-gray-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                    Interview Transcript Preview
                  </h4>
                  <div className="max-h-96 overflow-y-auto bg-white p-6 rounded-xl border border-gray-200">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {selectedResult.transcript.substring(0, 1000)}
                      {selectedResult.transcript.length > 1000 && '...'}
                    </pre>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Total transcript length: {selectedResult.transcript.length} characters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Interview Results" 
          subtitle="Loading interview results..."
        />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Interview Results" 
          subtitle="Error loading results"
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">Failed to load interview results. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Interview Results" 
        subtitle="Comprehensive AI-powered candidate evaluation reports"
      />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {!jobsWithResults || jobsWithResults.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No interview results yet</h3>
              <p className="text-gray-600">Candidates need to complete interviews before results appear here.</p>
            </div>
          </div>
        ) : (
          jobsWithResults.map((job) => (
            <div key={job.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    {expandedJob === job.id ? (
                      <ChevronDownIcon className="w-5 h-5 text-purple-600" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <BriefcaseIcon className="w-5 h-5" />
                      {job.job_role}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {job.required_experience} • Created {format(new Date(job.created_at), 'PPP')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="px-5 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm">
                    {job.total_interviews} interview{job.total_interviews !== 1 ? 's' : ''} completed
                  </div>
                  {job.total_interviews > 0 && (
                    <div className={`px-4 py-2 text-sm font-bold rounded-full border ${getScoreBadgeColor(job.avg_score)}`}>
                      Avg: {job.avg_score}%
                    </div>
                  )}
                  <span className={`px-4 py-2 text-xs font-bold rounded-full ${
                    job.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </button>

              {expandedJob === job.id && (
                <div className="px-8 pb-8 border-t border-gray-100 bg-gray-50">
                  <div className="pt-6 space-y-6">
                    {job.interview_results.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No interviews completed for this job post yet.</p>
                      </div>
                    ) : (
                      job.interview_results.map((result) => (
                        <div key={result.id} className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-purple-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                <UserIcon className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-xl font-bold text-gray-900">
                                  {result.candidate_name || 'Anonymous Candidate'}
                                </h4>
                                <p className="text-sm text-gray-600 flex items-center mt-1">
                                  <CheckCircleIcon className="w-4 h-4 mr-1 text-green-500" />
                                  Interview completed on {format(new Date(result.created_at), 'PPP')}
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                  <span className={`inline-flex items-center px-3 py-1 text-sm font-bold rounded-full ${getScoreBadgeColor(result.overall_score)}`}>
                                    Overall Score: {result.overall_score}%
                                  </span>
                                  {result.cheating_detected && (
                                    <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 text-sm font-bold rounded-full">
                                      <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                                      Cheating Detected
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedResultId(result.id)}
                              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                              View Detailed Report
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
