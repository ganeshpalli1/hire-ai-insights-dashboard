import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon, StarIcon, BriefcaseIcon, ComputerDesktopIcon, UserGroupIcon, AcademicCapIcon, PencilIcon, CheckIcon, XMarkIcon, CloudArrowUpIcon, DocumentArrowUpIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { ResumeAnalysisResult, JobResultsResponse, ProcessingStatus } from '../lib/api';
import { InterviewService } from '../lib/services';
import { useUpdateResumeResult } from '../hooks/useResumes';
import type { CandidateType, CandidateLevel } from '../types/database';

export const ResumeResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<Record<string, ResumeAnalysisResult[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [generatingLinks, setGeneratingLinks] = useState<Record<string, boolean>>({});
  const [editingCandidate, setEditingCandidate] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ category: CandidateType; level: CandidateLevel } | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{
    url: string;
    candidateName: string;
    jobRole: string;
    expiresAt: string;
  } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // Upload functionality state
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const [uploadComplete, setUploadComplete] = useState<Record<string, boolean>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, ProcessingStatus | null>>({});
  const [showUploadSection, setShowUploadSection] = useState<Record<string, boolean>>({});
  
  const { jobs, getJobResults, uploadResumes, pollProcessingStatus } = useJobs();
  const updateResumeResult = useUpdateResumeResult();

  // Category and level options for dropdowns
  const categoryOptions: { value: CandidateType; label: string }[] = [
    { value: 'tech', label: 'Technical' },
    { value: 'non-tech', label: 'Non-Technical' },
    { value: 'semi-tech', label: 'Semi-Technical' }
  ];

  const levelOptions: { value: CandidateLevel; label: string }[] = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' }
  ];

  const loadJobResults = async (jobId: string) => {
    if (jobResults[jobId]) return; // Already loaded

    setLoading(prev => ({ ...prev, [jobId]: true }));
    try {
      const response: JobResultsResponse = await getJobResults(jobId, filters[jobId] || {});
      setJobResults(prev => ({ ...prev, [jobId]: response.results }));
    } catch (error) {
      console.error('Error loading job results:', error);
      toast.error('Failed to load candidate results');
      setJobResults(prev => ({ ...prev, [jobId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const handleJobToggle = (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      loadJobResults(jobId);
    }
  };

  const handleSendInterviewLink = async (candidate: ResumeAnalysisResult) => {
    setGeneratingLinks(prev => ({ ...prev, [candidate.resume_id]: true }));
    
    try {
      const interviewData = await InterviewService.generateInterviewLink(candidate.resume_id);
      
      // Construct the complete URL to go through instructions page first
      const baseUrl = window.location.origin; // Gets the current domain
      const sessionId = interviewData.session_id;
      const fullUrl = `${baseUrl}/interview-instructions?session=${sessionId}`;
      
      setGeneratedLink({
        url: fullUrl,
        candidateName: interviewData.candidate_name || candidate.filename.replace(/\.(pdf|doc|docx)$/i, '').replace(/[_-]/g, ' '),
        jobRole: interviewData.job_role || 'Interview',
        expiresAt: interviewData.expires_at
      });
      setShowLinkModal(true);
      
      toast.success('Interview link generated successfully!');
      console.log('Interview data:', interviewData);
    } catch (error) {
      console.error('Error generating interview link:', error);
      
      // Provide specific error messages based on the error type
      const errorMessage = error.message || 'Unknown error';
      
      if (errorMessage.includes('not found in database or memory')) {
        toast.error('Candidate not found', {
          description: 'This candidate may have been deleted or the data was not saved properly. Please refresh the page.'
        });
      } else if (errorMessage.includes('The result contains 0 rows')) {
        toast.error('Candidate data missing', {
          description: 'The candidate information is not available in the database. Please re-upload the resume.'
        });
      } else if (errorMessage.includes('Database error')) {
        toast.error('Database connection error', {
          description: 'Please check your connection and try again.'
        });
      } else {
        toast.error('Failed to generate interview link', {
          description: 'Please try again or contact support if the problem persists.'
        });
      }
    } finally {
      setGeneratingLinks(prev => ({ ...prev, [candidate.resume_id]: false }));
    }
  };

  // Functions for editing category and level
  const startEditing = (candidateId: string, currentCategory: CandidateType, currentLevel: CandidateLevel) => {
    setEditingCandidate(candidateId);
    setEditValues({ category: currentCategory, level: currentLevel });
  };

  const cancelEditing = () => {
    setEditingCandidate(null);
    setEditValues(null);
  };

  const saveChanges = async (candidateId: string, jobId: string) => {
    if (!editValues) return;
    
    try {
      await updateResumeResult.mutateAsync({
        resumeId: candidateId,
        updates: {
          candidate_type: editValues.category,
          candidate_level: editValues.level,
          updated_at: new Date().toISOString()
        }
      });

      // Update local state
      setJobResults(prev => ({
        ...prev,
        [jobId]: prev[jobId].map(candidate => 
          candidate.resume_id === candidateId 
            ? {
                ...candidate,
                classification: {
                  ...candidate.classification,
                  category: editValues.category,
                  level: editValues.level
                }
              }
            : candidate
        )
      }));

      toast.success('Classification updated successfully!');
      setEditingCandidate(null);
      setEditValues(null);
    } catch (error) {
      console.error('Error updating classification:', error);
      toast.error('Failed to update classification. Please try again.');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 80) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'STRONG_FIT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'GOOD_FIT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MODERATE_FIT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'WEAK_FIT':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatRecommendation = (recommendation: string) => {
    return recommendation.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tech':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'non-tech':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'semi-tech':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'entry':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'mid':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'senior':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCategory = (category: string) => {
    const categoryMap = {
      'tech': 'Technical',
      'non-tech': 'Non-Technical', 
      'semi-tech': 'Semi-Technical'
    };
    return categoryMap[category as keyof typeof categoryMap] || category;
  };

  const formatLevel = (level: string) => {
    const levelMap = {
      'entry': 'Entry Level',
      'mid': 'Mid Level',
      'senior': 'Senior Level'
    };
    return levelMap[level as keyof typeof levelMap] || level;
  };

  const getInitials = (candidate: ResumeAnalysisResult) => {
    // Use candidate_name if available, otherwise fall back to filename
    const name = candidate.candidate_name || candidate.filename.replace(/\.(pdf|doc|docx)$/i, '').replace(/[_-]/g, ' ');
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatExperienceFromClassification = (classification: any) => {
    if (classification?.level) {
      const levelMap = {
        'entry': '0-2 years',
        'mid': '3-7 years',
        'senior': '8+ years'
      };
      return levelMap[classification.level as keyof typeof levelMap] || classification.level;
    }
    return 'Experience not specified';
  };

  const handleFileUpload = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...files] }));
    }
  };

  const handleFolderUpload = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'application/msword' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')
      );
      setUploadedFiles(prev => ({ ...prev, [jobId]: files }));
      
      if (files.length === 0) {
        toast.warning('No resume files found in the selected folder');
      }
    }
  };

  const handleRemoveFile = (jobId: string, index: number) => {
    setUploadedFiles(prev => ({
      ...prev,
      [jobId]: prev[jobId]?.filter((_, i) => i !== index) || []
    }));
  };

  const handleUploadResumes = async (jobId: string) => {
    const files = uploadedFiles[jobId];
    if (!files || files.length === 0) {
      toast.error('Please select resumes to upload');
      return;
    }

    setIsUploading(prev => ({ ...prev, [jobId]: true }));
    try {
      // Convert File[] to FileList
      const fileList = new DataTransfer();
      files.forEach(file => fileList.items.add(file));
      
      await uploadResumes(jobId, fileList.files);
      setUploadComplete(prev => ({ ...prev, [jobId]: true }));
      
      // Start polling for processing status
      await pollProcessingStatus(jobId, (status) => {
        setProcessingStatus(prev => ({ ...prev, [jobId]: status }));
      });
      
      toast.success('Resume processing completed!');
      
      // Refresh job results
      loadJobResults(jobId);
      
      // Clear uploaded files
      setUploadedFiles(prev => ({ ...prev, [jobId]: [] }));
      
    } catch (error) {
      console.error('Error uploading resumes:', error);
      toast.error('Failed to upload resumes');
    } finally {
      setIsUploading(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const toggleUploadSection = (jobId: string) => {
    setShowUploadSection(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Resume Results" 
        subtitle="AI-analyzed candidates ranked by job fit"
      />
      
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {jobs.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UsersIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">No resume results yet</h3>
              <p className="text-gray-600 leading-relaxed">Create job posts and upload resumes to see candidate analysis here.</p>
            </div>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-sm">
              <button
                onClick={() => handleJobToggle(job.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                    {expandedJob === job.id ? (
                      <ChevronDownIcon className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.job_role}</h3>
                    <div className="flex items-center text-sm text-gray-500 space-x-3">
                      <span className="flex items-center">
                        <BriefcaseIcon className="w-4 h-4 mr-1" />
                        {job.required_experience}
                      </span>
                      <span>•</span>
                      <span>Created {job.dateCreated}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-2 font-medium">
                    {jobResults[job.id]?.length || 0} candidates analyzed
                  </Badge>
                  <Badge className={`${
                    job.status === 'Active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : job.status === 'Processing'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  } border`}>
                    {job.status}
                  </Badge>
                </div>
              </button>

              {expandedJob === job.id && (
                <div className="border-t border-gray-100 bg-gray-50/30">
                  <CardContent className="p-6">
                    {loading[job.id] ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Loading candidate results...</span>
                      </div>
                    ) : !jobResults[job.id] || jobResults[job.id].length === 0 ? (
                      <div className="text-center py-8">
                        <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No candidates analyzed yet</h4>
                        <p className="text-gray-600">Upload resumes in the job creation flow to see candidate analysis results.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Add More Candidates Button */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-lg font-semibold text-gray-900">Candidates</h4>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                              {jobResults[job.id]?.length || 0} analyzed
                            </Badge>
                          </div>
                          <Button 
                            onClick={() => toggleUploadSection(job.id)}
                            variant="outline"
                            size="sm"
                            className="flex items-center space-x-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            <CloudArrowUpIcon className="w-4 h-4" />
                            <span>Add More Candidates</span>
                          </Button>
                        </div>

                        {/* Upload Section */}
                        {showUploadSection[job.id] && (
                          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="text-lg font-semibold text-gray-900">Upload New Resumes</h5>
                              {uploadComplete[job.id] && (
                                <div className="flex items-center text-green-600">
                                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                                  <span className="text-sm font-medium">Upload Complete</span>
                                </div>
                              )}
                            </div>
                            
                            {!uploadComplete[job.id] && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Select Individual Files
                                    </label>
                                    <input
                                      type="file"
                                      multiple
                                      accept=".pdf,.doc,.docx"
                                      onChange={(e) => handleFileUpload(job.id, e)}
                                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 p-3"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Select from Folder
                                    </label>
                                    <input
                                      type="file"
                                      multiple
                                      accept=".pdf,.doc,.docx"
                                      onChange={(e) => handleFolderUpload(job.id, e)}
                                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 p-3"
                                    />
                                  </div>
                                </div>

                                {/* File List */}
                                {uploadedFiles[job.id] && uploadedFiles[job.id].length > 0 && (
                                  <div className="bg-gray-50 rounded-lg p-4">
                                    <h6 className="text-sm font-medium text-gray-700 mb-3">
                                      Selected Files ({uploadedFiles[job.id].length})
                                    </h6>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {uploadedFiles[job.id].map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                          <div className="flex items-center space-x-3">
                                            <DocumentArrowUpIcon className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-medium text-gray-900">{file.name}</span>
                                            <span className="text-xs text-gray-500">({Math.round(file.size / 1024)}KB)</span>
                                          </div>
                                          <button
                                            onClick={() => handleRemoveFile(job.id, index)}
                                            className="text-red-600 hover:text-red-700"
                                          >
                                            <TrashIcon className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Upload Button */}
                                <div className="flex justify-end space-x-3">
                                  <Button
                                    onClick={() => toggleUploadSection(job.id)}
                                    variant="outline"
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => handleUploadResumes(job.id)}
                                    disabled={isUploading[job.id] || !uploadedFiles[job.id] || uploadedFiles[job.id].length === 0}
                                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isUploading[job.id] ? (
                                      <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Processing...
                                      </div>
                                    ) : (
                                      'Upload & Process Resumes'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Processing Status */}
                            {processingStatus[job.id] && (
                              <div className="mt-4 bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-blue-900">Processing Progress</span>
                                  <span className="text-sm text-blue-700">
                                    {processingStatus[job.id]?.processed_resumes || 0} / {processingStatus[job.id]?.total_resumes || 0}
                                  </span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${processingStatus[job.id]?.completion_percentage || 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Classification Summary */}
                        {jobResults[job.id] && jobResults[job.id].length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Classification Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Category Distribution */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-3">By Category</h5>
                                <div className="space-y-2">
                                  {Object.entries(
                                    jobResults[job.id].reduce((acc: Record<string, number>, candidate) => {
                                      const category = candidate.classification?.category || 'unknown';
                                      acc[category] = (acc[category] || 0) + 1;
                                      return acc;
                                    }, {})
                                  ).map(([category, count]) => (
                                    <div key={category} className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`${getCategoryColor(category)} border text-xs px-2 py-1`}
                                        >
                                          {formatCategory(category)}
                                        </Badge>
                                      </div>
                                      <span className="text-sm font-medium text-gray-600">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Level Distribution */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-3">By Experience Level</h5>
                                <div className="space-y-2">
                                  {Object.entries(
                                    jobResults[job.id].reduce((acc: Record<string, number>, candidate) => {
                                      const level = candidate.classification?.level || 'unknown';
                                      acc[level] = (acc[level] || 0) + 1;
                                      return acc;
                                    }, {})
                                  ).map(([level, count]) => (
                                    <div key={level} className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`${getLevelColor(level)} border text-xs px-2 py-1`}
                                        >
                                          {formatLevel(level)}
                                        </Badge>
                                      </div>
                                      <span className="text-sm font-medium text-gray-600">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Candidate Cards */}
                        {jobResults[job.id].map((candidate, index) => (
                          <Card key={candidate.resume_id} className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-11 w-11">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm">
                                      {getInitials(candidate)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 text-lg">
                                      {candidate.candidate_name || candidate.filename.replace(/\.(pdf|doc|docx)$/i, '').replace(/[_-]/g, ' ')}
                                    </h4>
                                    <div className="flex items-center text-sm text-gray-600 mt-1 space-x-3">
                                      <span className="flex items-center">
                                        <StarIcon className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                                        {formatExperienceFromClassification(candidate.classification)}
                                      </span>
                                      <Badge variant="outline" className={getRecommendationColor(candidate.recommendation)}>
                                        {formatRecommendation(candidate.recommendation)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center mt-2 space-x-2">
                                      {/* Category Badge/Dropdown */}
                                      {editingCandidate === candidate.resume_id ? (
                                        <div className="flex items-center space-x-2">
                                          <select
                                            value={editValues?.category || candidate.classification?.category || 'tech'}
                                            onChange={(e) => setEditValues(prev => prev ? { ...prev, category: e.target.value as CandidateType } : null)}
                                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                                          >
                                            {categoryOptions.map(option => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                          <select
                                            value={editValues?.level || candidate.classification?.level || 'mid'}
                                            onChange={(e) => setEditValues(prev => prev ? { ...prev, level: e.target.value as CandidateLevel } : null)}
                                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                                          >
                                            {levelOptions.map(option => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                          <button
                                            onClick={() => saveChanges(candidate.resume_id, job.id)}
                                            disabled={updateResumeResult.isPending}
                                            className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                          >
                                            <CheckIcon className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={cancelEditing}
                                            className="p-1 text-red-600 hover:text-red-700"
                                          >
                                            <XMarkIcon className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-2">
                                          <Badge 
                                            variant="outline" 
                                            className={`${getCategoryColor(candidate.classification?.category || 'tech')} border text-xs font-medium px-3 py-1 flex items-center space-x-1`}
                                          >
                                            {candidate.classification?.category === 'tech' && <ComputerDesktopIcon className="w-3 h-3" />}
                                            {candidate.classification?.category === 'non-tech' && <UserGroupIcon className="w-3 h-3" />}
                                            {candidate.classification?.category === 'semi-tech' && <AcademicCapIcon className="w-3 h-3" />}
                                            <span>{formatCategory(candidate.classification?.category || 'tech')}</span>
                                          </Badge>
                                          <Badge 
                                            variant="outline" 
                                            className={`${getLevelColor(candidate.classification?.level || 'mid')} border text-xs font-medium px-3 py-1 flex items-center space-x-1`}
                                          >
                                            <StarIcon className="w-3 h-3" />
                                            <span>{formatLevel(candidate.classification?.level || 'mid')}</span>
                                          </Badge>
                                          <button
                                            onClick={() => startEditing(
                                              candidate.resume_id,
                                              candidate.classification?.category as CandidateType || 'tech',
                                              candidate.classification?.level as CandidateLevel || 'mid'
                                            )}
                                            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                            title="Edit classification"
                                          >
                                            <PencilIcon className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                      {candidate.classification?.confidence && (
                                        <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200 text-xs px-3 py-1">
                                          {Math.round(candidate.classification.confidence * 100)}% confidence
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 ${getScoreColor(candidate.fit_score)}`}>
                                    <div>
                                      <div className="text-xl font-bold">{Math.round(candidate.fit_score)}%</div>
                                      <div className="text-xs font-medium -mt-1">Match</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mb-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <div className="flex items-center mb-3">
                                      <div className={`w-2 h-2 rounded-full mr-2 ${getScoreBadgeColor(candidate.fit_score)}`}></div>
                                      <h5 className="text-sm font-semibold text-gray-700">Matching Skills</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {candidate.matching_skills.slice(0, 6).map((skill, skillIndex) => (
                                        <Badge key={skillIndex} variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 text-xs font-medium">
                                          {skill}
                                        </Badge>
                                      ))}
                                      {candidate.matching_skills.length > 6 && (
                                        <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200 px-3 py-1 text-xs font-medium">
                                          +{candidate.matching_skills.length - 6} more
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center mb-3">
                                      <div className="w-2 h-2 rounded-full mr-2 bg-red-500"></div>
                                      <h5 className="text-sm font-semibold text-gray-700">Areas to Develop</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {candidate.missing_skills.slice(0, 4).map((skill, skillIndex) => (
                                        <Badge key={skillIndex} variant="outline" className="bg-red-50 text-red-700 border-red-200 px-3 py-1 text-xs font-medium">
                                          {skill}
                                        </Badge>
                                      ))}
                                      {candidate.missing_skills.length > 4 && (
                                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 px-3 py-1 text-xs font-medium">
                                          +{candidate.missing_skills.length - 4} more
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {candidate.detailed_analysis?.detailed_feedback && (
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h5 className="text-sm font-semibold text-gray-700 mb-2">AI Analysis Summary</h5>
                                    <p className="text-sm text-gray-600 line-clamp-3">
                                      {candidate.detailed_analysis.detailed_feedback}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end pt-2">
                                <Button 
                                  onClick={() => handleSendInterviewLink(candidate)}
                                  disabled={generatingLinks[candidate.resume_id]}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {generatingLinks[candidate.resume_id] && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  )}
                                  {generatingLinks[candidate.resume_id] ? 'Generating...' : 'Send Interview Link'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Interview Link Modal */}
      {showLinkModal && generatedLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Interview Link Generated</h2>
                  <p className="text-gray-600 mt-1">Ready to send to candidate</p>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <UsersIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Candidate:</span>
                    <span className="text-blue-800">{generatedLink.candidateName}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <BriefcaseIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Position:</span>
                    <span className="text-blue-800">{generatedLink.jobRole}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StarIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Expires:</span>
                    <span className="text-blue-800">{new Date(generatedLink.expiresAt).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Link (Click to copy)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={generatedLink.url}
                      readOnly
                      onClick={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.select();
                        navigator.clipboard.writeText(generatedLink.url);
                        toast.success('Link copied to clipboard!');
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-mono text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink.url);
                        toast.success('Link copied to clipboard!');
                      }}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This link will expire in 24 hours. The candidate can access their interview using this unique link.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const mailtoLink = `mailto:?subject=Interview Link - ${generatedLink.candidateName}&body=Hello,\n\nYou have been invited to participate in a video interview for the ${generatedLink.jobRole} position.\n\nPlease use the following link to access your interview:\n${generatedLink.url}\n\nThis link will expire on ${new Date(generatedLink.expiresAt).toLocaleString()}.\n\nBest regards`;
                    window.open(mailtoLink);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Send via Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
