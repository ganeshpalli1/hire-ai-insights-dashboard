
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';

const mockCandidates = [
  { name: 'John Doe', score: 92, skills: ['React', 'TypeScript', 'Node.js'], experience: '5 years' },
  { name: 'Jane Smith', score: 87, skills: ['Vue.js', 'JavaScript', 'Python'], experience: '4 years' },
  { name: 'Mike Johnson', score: 78, skills: ['React', 'JavaScript', 'MongoDB'], experience: '3 years' },
];

export const ResumeResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const { jobs } = useJobs();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Resume Results" 
        subtitle="AI-analyzed candidates ranked by job fit"
      />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No resume results yet</h3>
              <p className="text-gray-600">Create job posts and upload resumes to see candidate analysis here.</p>
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
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {mockCandidates.length} candidates analyzed
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
                    {mockCandidates.map((candidate, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{candidate.name}</h4>
                            <p className="text-sm text-gray-600">{candidate.experience} experience</p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-green-600">{candidate.score}%</div>
                            <div className="text-sm text-gray-500 font-medium">Match Score</div>
                          </div>
                        </div>

                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-gray-700 mb-3">Key Skills</h5>
                          <div className="flex flex-wrap gap-2">
                            {candidate.skills.map((skill, skillIndex) => (
                              <span key={skillIndex} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
                            Send Interview Link
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
