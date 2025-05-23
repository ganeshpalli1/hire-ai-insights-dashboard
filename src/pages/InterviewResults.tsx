
import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { PlayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const mockResults = [
  {
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
  }
];

export const InterviewResults: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Interview Results" 
        subtitle="Comprehensive AI-powered candidate evaluation reports"
      />
      
      <div className="p-6 space-y-6">
        {mockResults.map((result) => (
          <div key={result.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Candidate Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{result.candidate.name}</h3>
                  <p className="text-gray-600">{result.candidate.currentRole}</p>
                  <p className="text-sm text-gray-500">{result.candidate.experience} experience</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{result.candidate.email}</p>
                  <p>{result.candidate.phone}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Resume Highlights & Interview Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Resume Highlights</h4>
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Key Skills</h5>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {result.resume.skills.map((skill, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Notable Projects</h5>
                      <p className="text-sm text-gray-600">{result.resume.projects}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Certifications</h5>
                      <p className="text-sm text-gray-600">{result.resume.certifications}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Video Interview Summary</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Date:</span>
                        <span className="ml-2 text-gray-600">{result.interview.date}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Duration:</span>
                        <span className="ml-2 text-gray-600">{result.interview.duration}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Questions:</span>
                        <span className="ml-2 text-gray-600">{result.interview.questionsAnswered}</span>
                      </div>
                      <div>
                        <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-800">
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
                <h4 className="text-lg font-medium text-gray-900 mb-3">Scoring & Evaluation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(result.scores).filter(([key]) => key !== 'recommendation').map(([category, score]) => (
                    <div key={category} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{score}%</div>
                      <div className="text-sm text-gray-600 capitalize">{category}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    System Recommendation: {result.scores.recommendation}
                  </p>
                </div>
              </div>

              {/* AI Observations & Areas of Improvement */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">AI Observations</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Confidence Level:</span>
                      <span className="font-medium">{result.observations.confidence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Cheating Detection:</span>
                      <span className="font-medium text-green-600">{result.observations.cheating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Body Language:</span>
                      <span className="font-medium">{result.observations.bodyLanguage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Speech Pattern:</span>
                      <span className="font-medium">{result.observations.speechPattern}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Areas of Improvement</h4>
                  <ul className="space-y-2">
                    {result.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-gray-600">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Pre-Qualifier Summary */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Pre-Qualifier Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-700">Relocation:</span>
                    <span className="ml-2 font-medium text-green-600">{result.preQualifier.relocation}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">WFO Available:</span>
                    <span className="ml-2 font-medium text-green-600">{result.preQualifier.wfo}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">Notice Period:</span>
                    <span className="ml-2 font-medium">{result.preQualifier.noticePeriod}</span>
                  </div>
                  <div>
                    <span className="text-gray-700">Compensation:</span>
                    <span className="ml-2 font-medium text-green-600">{result.preQualifier.compensation}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    result.preQualifier.status === 'Qualified'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.preQualifier.status}
                  </span>
                </div>
              </div>

              {/* Recruiter Notes */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Recruiter Notes</h4>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add your notes and recommendations for next steps..."
                  defaultValue={result.notes}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
