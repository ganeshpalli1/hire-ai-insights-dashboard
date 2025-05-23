
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, PlayIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';

const mockCandidateResult = {
  id: 1,
  candidate: {
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1 234 567 8900',
    currentRole: 'Frontend Developer',
    experience: '5 years'
  },
  resume: {
    skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'MongoDB'],
    projects: 'E-commerce platform, CRM system',
    certifications: 'AWS Certified Developer'
  },
  interview: {
    date: '2024-01-15',
    duration: '28 minutes',
    questionsAnswered: '12/15',
    videoLink: '#'
  },
  scores: {
    domain: 85,
    behavioral: 78,
    communication: 82,
    overall: 81,
    recommendation: 'Recommended for Panel Interview'
  },
  observations: {
    confidence: 'High',
    cheating: 'Not Detected',
    bodyLanguage: 'Confident and engaged',
    speechPattern: 'Clear and articulate'
  },
  improvements: [
    'Strengthen knowledge in system design',
    'Practice explaining complex concepts simply',
    'Improve answers to behavioral questions'
  ],
  preQualifier: {
    relocation: 'Yes',
    wfo: 'Yes',
    noticePeriod: '2 months',
    compensation: 'Yes',
    status: 'Qualified'
  },
  notes: ''
};

export const InterviewResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { jobs } = useJobs();

  const mockCandidates = ['John Doe', 'Jane Smith']; // Mock candidates for each job

  if (selectedCandidate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Interview Results" 
          subtitle="Detailed candidate evaluation report"
          action={
            <button
              onClick={() => setSelectedCandidate(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back to Jobs
            </button>
          }
        />
        
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Candidate Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{mockCandidateResult.candidate.name}</h3>
                  <p className="text-gray-600 text-lg">{mockCandidateResult.candidate.currentRole}</p>
                  <p className="text-sm text-gray-500">{mockCandidateResult.candidate.experience} experience</p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{mockCandidateResult.candidate.email}</p>
                  <p>{mockCandidateResult.candidate.phone}</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Resume Highlights & Interview Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Resume Highlights</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Key Skills</h5>
                      <div className="flex flex-wrap gap-2">
                        {mockCandidateResult.resume.skills.map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Notable Projects</h5>
                      <p className="text-sm text-gray-600 mt-1">{mockCandidateResult.resume.projects}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Certifications</h5>
                      <p className="text-sm text-gray-600 mt-1">{mockCandidateResult.resume.certifications}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Video Interview Summary</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Date:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.date}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Duration:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.duration}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Questions:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.questionsAnswered}</span>
                      </div>
                      <div>
                        <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium">
                          <PlayIcon className="w-4 h-4" />
                          <span>View Video</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring & Evaluation */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Scoring & Evaluation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(mockCandidateResult.scores).filter(([key]) => key !== 'recommendation').map(([category, score]) => (
                    <div key={category} className="text-center p-6 bg-gray-50 rounded-xl">
                      <div className="text-3xl font-bold text-blue-600">{score}%</div>
                      <div className="text-sm text-gray-600 capitalize font-medium">{category}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm font-medium text-green-800">
                    System Recommendation: {mockCandidateResult.scores.recommendation}
                  </p>
                </div>
              </div>

              {/* AI Observations & Areas of Improvement */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">AI Observations</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Confidence Level:</span>
                      <span className="font-medium">{mockCandidateResult.observations.confidence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Cheating Detection:</span>
                      <span className="font-medium text-green-600">{mockCandidateResult.observations.cheating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Body Language:</span>
                      <span className="font-medium">{mockCandidateResult.observations.bodyLanguage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Speech Pattern:</span>
                      <span className="font-medium">{mockCandidateResult.observations.speechPattern}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Areas of Improvement</h4>
                  <ul className="space-y-3">
                    {mockCandidateResult.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-gray-600">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Pre-Qualifier Summary */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Pre-Qualifier Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-700">Relocation:</span>
                    <span className="ml-2 font-medium text-green-600">{mockCandidateResult.preQualifier.relocation}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">WFO Available:</span>
                    <span className="ml-2 font-medium text-green-600">{mockCandidateResult.preQualifier.wfo}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">Notice Period:</span>
                    <span className="ml-2 font-medium">{mockCandidateResult.preQualifier.noticePeriod}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">Compensation:</span>
                    <span className="ml-2 font-medium text-green-600">{mockCandidateResult.preQualifier.compensation}</span>
                  </div>
                </div>
                <div>
                  <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${
                    mockCandidateResult.preQualifier.status === 'Qualified'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {mockCandidateResult.preQualifier.status}
                  </span>
                </div>
              </div>

              {/* Recruiter Notes */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recruiter Notes</h4>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add your notes and recommendations for next steps..."
                  defaultValue={mockCandidateResult.notes}
                />
              </div>
            </div>
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
        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No interview results yet</h3>
              <p className="text-gray-600">Candidates need to complete interviews before results appear here.</p>
            </div>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                className="w-full px-6 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {expandedJob === job.id ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{job.role}</h3>
                    <p className="text-sm text-gray-500">{job.experience} • Created {job.dateCreated}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                    {mockCandidates.length} interviews completed
                  </span>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    job.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </button>

              {expandedJob === job.id && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="pt-6 space-y-4">
                    {mockCandidates.map((candidateName, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{candidateName}</h4>
                            <p className="text-sm text-gray-600">Interview completed on {mockCandidateResult.interview.date}</p>
                            <p className="text-sm text-green-600 font-medium mt-1">Overall Score: {mockCandidateResult.scores.overall}%</p>
                          </div>
                          <button
                            onClick={() => setSelectedCandidate(candidateName)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                          >
                            View Detailed Report
                          </button>
                        </div>
                      </div>
                    ))}
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
