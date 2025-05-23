
import React, { useState, ChangeEvent } from 'react';
import { DocumentIcon, FolderIcon } from '@heroicons/react/24/outline';

interface AIAnalysisProps {
  jobData: any;
  onNext: () => void;
  onPrev: () => void;
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({ jobData, onNext, onPrev }) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const mockSkills = ['React', 'TypeScript', 'Node.js', 'GraphQL', 'MongoDB'];
  const mockRequirements = ['5+ years experience', 'Leadership skills', 'Remote work experience'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'application/msword' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      setUploadedFiles(files);
    }
  };

  return (
    <div className="space-y-8">
      {/* AI Extracted Information - Full Width */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">AI Job Analysis</h3>
        
        <div className="grid grid-cols-1 gap-8">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {mockSkills.map((skill, index) => (
                <span key={index} className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Key Requirements</h4>
            <ul className="space-y-2">
              {mockRequirements.map((req, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Resume Upload - Full Width */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Upload Resumes</h3>
        
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

        {uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Uploaded Files ({uploadedFiles.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
                  <DocumentIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600 truncate">{file.name}</span>
                </div>
              ))}
            </div>
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
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Continue to Interview Setup
        </button>
      </div>
    </div>
  );
};
