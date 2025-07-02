import React, { useState, useEffect } from 'react';
import { DocumentIcon, FolderIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';
import { toast } from 'sonner';
import { JobAnalysis, ProcessingStatus } from '../lib/api.ts';

interface AIAnalysisProps {
  jobData: {
    role: string;
    experience: string;
    description: string;
  };
  jobId: string | null;
  onNext: () => void;
  onPrev: () => void;
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({ jobData, jobId, onNext, onPrev }) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  
  const { getJob, uploadResumes, pollProcessingStatus } = useJobs();

  // Load job analysis data
  useEffect(() => {
    const loadJobAnalysis = async () => {
      if (!jobId) return;
      
      setAnalysisLoading(true);
      try {
        const job = getJob(jobId);
        if (job?.analysis) {
          setJobAnalysis(job.analysis);
        }
      } catch (error) {
        console.error('Error loading job analysis:', error);
        toast.error('Failed to load job analysis');
      } finally {
        setAnalysisLoading(false);
      }
    };

    loadJobAnalysis();
  }, [jobId, getJob]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prevFiles => [...prevFiles, ...files]);
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'application/msword' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')
      );
      setUploadedFiles(files);
      
      if (files.length === 0) {
        toast.warning('No resume files found in the selected folder');
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  const handleUploadResumes = async () => {
    if (!jobId || uploadedFiles.length === 0) {
      toast.error('Please select resumes to upload');
      return;
    }

    setIsUploading(true);
    try {
      // Convert File[] to FileList
      const fileList = new DataTransfer();
      uploadedFiles.forEach(file => fileList.items.add(file));
      
      await uploadResumes(jobId, fileList.files);
      setUploadComplete(true);
      
      // Start polling for processing status
      await pollProcessingStatus(jobId, (status) => {
        setProcessingStatus(status);
      });
      
      toast.success('Resume processing completed!');
    } catch (error) {
      console.error('Error uploading resumes:', error);
      toast.error('Failed to upload resumes');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (uploadedFiles.length === 0) {
      toast.warning('Consider uploading resumes to get candidate analysis');
    }
    onNext();
  };

  return (
    <div className="space-y-8">
      {/* AI Extracted Information */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">AI Job Analysis</h3>
        
        {analysisLoading ? (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-blue-200 rounded w-1/4 mb-4"></div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-blue-200 rounded-full w-20"></div>
                ))}
              </div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-blue-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-blue-200 rounded w-3/4"></div>
                ))}
              </div>
            </div>
          </div>
        ) : jobAnalysis ? (
          <div className="grid grid-cols-1 gap-8">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Required Skills</h4>
              <div className="flex flex-wrap gap-2">
                {jobAnalysis.required_skills.technical.map((skill, index) => (
                  <span key={index} className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                    {skill}
                  </span>
                ))}
                {jobAnalysis.required_skills.soft.map((skill, index) => (
                  <span key={index} className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Key Requirements</h4>
              <ul className="space-y-2">
                {jobAnalysis.key_responsibilities.slice(0, 5).map((req, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Technology Stack</h4>
              <div className="flex flex-wrap gap-2">
                {jobAnalysis.technology_stack.map((tech, index) => (
                  <span key={index} className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">
              Job analysis is being processed... This may take a moment.
            </div>
          </div>
        )}
      </div>

      {/* Resume Upload */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Upload Resumes</h3>
          {uploadComplete && (
            <div className="flex items-center text-green-600">
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Upload Complete</span>
            </div>
          )}
        </div>
        
        {!uploadComplete && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Individual Files Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Upload Individual Resumes</p>
                <p className="text-sm text-gray-600">Drag and drop resumes here, or</p>
                <label className="inline-block cursor-pointer">
                  <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Browse Files
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500">Supports PDF, DOC, DOCX</p>
              </div>
            </div>

            {/* Folder Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition-colors">
              <FolderIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Upload Resume Folder</p>
                <p className="text-sm text-gray-600">Select a folder containing resumes</p>
                <label className="inline-block cursor-pointer">
                  <span className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                    Select Folder
                  </span>
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500">Automatically filters resume files</p>
              </div>
            </div>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Selected Files ({uploadedFiles.length})</h4>
              {!uploadComplete && (
                <button
                  onClick={handleUploadResumes}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 text-sm font-medium"
                >
                  {isUploading ? 'Uploading...' : 'Start Processing'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between space-x-3 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-3 min-w-0">
                    <DocumentIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                  </div>
                  {!uploadComplete && (
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {processingStatus && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Processing Resumes</span>
              <span className="text-sm text-blue-700">
                {processingStatus.processed_resumes} / {processingStatus.total_resumes}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${processingStatus.completion_percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              {processingStatus.completion_percentage < 100 
                ? 'Analyzing resumes with AI...' 
                : 'Processing complete! Results are available.'
              }
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Continue to Interview Setup
        </button>
      </div>
    </div>
  );
};
