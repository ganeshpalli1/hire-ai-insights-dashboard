
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, PlayIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
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

  const mockCandidates = ['John Doe', 'Jane Smith'];

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-green-500 to-green-600 text-white';
    if (score >= 75) return 'from-blue-500 to-blue-600 text-white';
    if (score >= 65) return 'from-orange-500 to-orange-600 text-white';
    return 'from-red-500 to-red-600 text-white';
  };

  if (selectedCandidate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Interview Results" 
          subtitle="Detailed candidate evaluation report"
          action={
            <button
              onClick={() => setSelectedCandidate(null)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold shadow-sm transition-colors"
            >
              ← Back to Jobs
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
                    {mockCandidateResult.candidate.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{mockCandidateResult.candidate.name}</h3>
                    <p className="text-gray-600 text-lg">{mockCandidateResult.candidate.currentRole}</p>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {mockCandidateResult.candidate.experience} experience
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-2 bg-white p-4 rounded-xl border border-gray-200">
                  <p className="flex items-center"><span className="font-semibold mr-2">Email:</span>{mockCandidateResult.candidate.email}</p>
                  <p className="flex items-center"><span className="font-semibold mr-2">Phone:</span>{mockCandidateResult.candidate.phone}</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Resume Highlights & Interview Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl border border-gray-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Resume Highlights</h4>
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-lg font-semibold text-gray-700 mb-4">Key Skills</h5>
                      <div className="flex flex-wrap gap-3">
                        {mockCandidateResult.resume.skills.map((skill, index) => (
                          <span key={index} className="px-5 py-2 bg-gray-200 text-gray-800 text-sm rounded-xl font-semibold shadow-sm hover:shadow-md transition-shadow">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-700 mb-3">Notable Projects</h5>
                      <p className="text-sm text-gray-600">{mockCandidateResult.resume.projects}</p>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-700 mb-3">Certifications</h5>
                      <p className="text-sm text-gray-600">{mockCandidateResult.resume.certifications}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Video Interview Summary</h4>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                      <div>
                        <span className="font-semibold text-gray-700">Date:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.date}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Duration:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.duration}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Questions:</span>
                        <span className="ml-2 text-gray-600">{mockCandidateResult.interview.questionsAnswered}</span>
                      </div>
                      <div>
                        <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                          <PlayIcon className="w-5 h-5" />
                          <span>View Video</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring & Evaluation */}
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-6">Scoring & Evaluation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  {Object.entries(mockCandidateResult.scores)
                    .filter(([key, value]) => key !== 'recommendation' && typeof value === 'number')
                    .map(([category, score]) => (
                    <div key={category} className={`text-center p-6 bg-gradient-to-br ${getScoreColor(score as number)} rounded-2xl shadow-lg`}>
                      <div className="text-3xl font-bold">{score}%</div>
                      <div className="text-sm capitalize font-semibold opacity-90">{category}</div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl">
                  <p className="text-sm font-bold text-green-800 flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    System Recommendation: {mockCandidateResult.scores.recommendation}
                  </p>
                </div>
              </div>

              {/* AI Observations & Areas of Improvement */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl border border-purple-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">AI Observations</h4>
                  <div className="space-y-4 text-lg">
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Confidence Level:</span>
                      <span className="font-bold">{mockCandidateResult.observations.confidence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Cheating Detection:</span>
                      <span className="font-bold text-green-600">{mockCandidateResult.observations.cheating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Body Language:</span>
                      <span className="font-bold">{mockCandidateResult.observations.bodyLanguage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-semibold">Speech Pattern:</span>
                      <span className="font-bold">{mockCandidateResult.observations.speechPattern}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-2xl border border-orange-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Areas of Improvement</h4>
                  <ul className="space-y-4 text-lg">
                    {mockCandidateResult.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <span className="w-3 h-3 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-gray-600">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Pre-Qualifier Summary */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-8 rounded-2xl border border-emerald-200">
                <h4 className="text-xl font-bold text-gray-900 mb-6">Pre-Qualifier Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-lg mb-6">
                  <div>
                    <span className="text-gray-700 font-semibold">Relocation:</span>
                    <span className="ml-2 font-bold text-green-600">{mockCandidateResult.preQualifier.relocation}</span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-semibold">WFO Available:</span>
                    <span className="ml-2 font-bold text-green-600">{mockCandidateResult.preQualifier.wfo}</span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-semibold">Notice Period:</span>
                    <span className="ml-2 font-bold">{mockCandidateResult.preQualifier.noticePeriod}</span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-semibold">Compensation:</span>
                    <span className="ml-2 font-bold text-green-600">{mockCandidateResult.preQualifier.compensation}</span>
                  </div>
                </div>
                <div>
                  <span className={`inline-flex px-6 py-3 text-lg font-bold rounded-full ${
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
                <h4 className="text-xl font-bold text-gray-900 mb-6">Recruiter Notes</h4>
                <textarea
                  rows={4}
                  className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
          jobs.map((job) => (
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
                    <h3 className="text-xl font-bold text-gray-900">{job.role}</h3>
                    <p className="text-sm text-gray-500 mt-1">{job.experience} • Created {job.dateCreated}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="px-5 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm">
                    {mockCandidates.length} interviews completed
                  </div>
                  <span className={`px-4 py-2 text-xs font-bold rounded-full ${
                    job.status === 'Active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </button>

              {expandedJob === job.id && (
                <div className="px-8 pb-8 border-t border-gray-100 bg-gray-50">
                  <div className="pt-6 space-y-6">
                    {mockCandidates.map((candidateName, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-purple-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {candidateName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-gray-900">{candidateName}</h4>
                              <p className="text-sm text-gray-600 flex items-center mt-1">
                                <CheckCircleIcon className="w-4 h-4 mr-1 text-green-500" />
                                Interview completed on {mockCandidateResult.interview.date}
                              </p>
                              <div className="mt-2">
                                <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-bold rounded-full">
                                  Overall Score: {mockCandidateResult.scores.overall}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedCandidate(candidateName)}
                            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
