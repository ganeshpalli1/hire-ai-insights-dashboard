
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon, StarIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';

const mockCandidates = [
  { name: 'John Doe', score: 92, skills: ['React', 'TypeScript', 'Node.js'], experience: '5 years' },
  { name: 'Jane Smith', score: 87, skills: ['Vue.js', 'JavaScript', 'Python'], experience: '4 years' },
  { name: 'Mike Johnson', score: 78, skills: ['React', 'JavaScript', 'MongoDB'], experience: '3 years' },
];

export const ResumeResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const { jobs } = useJobs();

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 70) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

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
            <div key={job.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {expandedJob === job.id ? (
                      <ChevronDownIcon className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-gray-900">{job.role}</h3>
                    <p className="text-sm text-gray-500 mt-1">{job.experience} • Created {job.dateCreated}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-full shadow-sm">
                    {mockCandidates.length} candidates analyzed
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
                    {mockCandidates.map((candidate, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-blue-200">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {candidate.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-gray-900">{candidate.name}</h4>
                              <p className="text-sm text-gray-600 flex items-center mt-1">
                                <StarIcon className="w-4 h-4 mr-1 text-yellow-500" />
                                {candidate.experience} experience
                              </p>
                            </div>
                          </div>
                          <div className={`text-right p-4 rounded-xl border-2 ${getScoreColor(candidate.score)}`}>
                            <div className="text-3xl font-bold">{candidate.score}%</div>
                            <div className="text-sm font-semibold">Match Score</div>
                          </div>
                        </div>

                        <div className="mb-8">
                          <h5 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            Key Skills
                          </h5>
                          <div className="flex flex-wrap gap-3">
                            {candidate.skills.map((skill, skillIndex) => (
                              <span key={skillIndex} className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-sm rounded-xl font-semibold border border-blue-200 hover:shadow-md transition-shadow">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
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
