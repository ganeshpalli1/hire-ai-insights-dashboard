
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const mockJobs = [
  {
    id: 1,
    role: 'Senior Frontend Developer',
    candidates: [
      { name: 'John Doe', score: 92, skills: ['React', 'TypeScript', 'Node.js'], experience: '5 years' },
      { name: 'Jane Smith', score: 87, skills: ['Vue.js', 'JavaScript', 'Python'], experience: '4 years' },
      { name: 'Mike Johnson', score: 78, skills: ['React', 'JavaScript', 'MongoDB'], experience: '3 years' },
    ]
  },
  {
    id: 2,
    role: 'Data Scientist',
    candidates: [
      { name: 'Alice Brown', score: 94, skills: ['Python', 'ML', 'TensorFlow'], experience: '6 years' },
      { name: 'Bob Wilson', score: 82, skills: ['R', 'Statistics', 'SQL'], experience: '4 years' },
    ]
  },
];

export const ResumeResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Resume Results" 
        subtitle="AI-analyzed candidates ranked by job fit"
      />
      
      <div className="p-6 space-y-6">
        {mockJobs.map((job) => (
          <div key={job.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedJob === job.id ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                )}
                <h3 className="text-lg font-medium text-gray-900">{job.role}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {job.candidates.length} candidates
                </span>
              </div>
            </button>

            {expandedJob === job.id && (
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  {job.candidates.map((candidate, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{candidate.name}</h4>
                          <p className="text-sm text-gray-600">{candidate.experience} experience</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{candidate.score}%</div>
                          <div className="text-sm text-gray-500">Match Score</div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Key Skills</h5>
                        <div className="flex flex-wrap gap-2">
                          {candidate.skills.map((skill, skillIndex) => (
                            <span key={skillIndex} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          Send Interview Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
