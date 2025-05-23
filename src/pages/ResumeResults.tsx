
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon, StarIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { useJobs } from '../contexts/JobContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';

const mockCandidates = [
  { name: 'John Doe', score: 92, skills: ['React', 'TypeScript', 'Node.js'], experience: '5 years' },
  { name: 'Jane Smith', score: 87, skills: ['Vue.js', 'JavaScript', 'Python'], experience: '4 years' },
  { name: 'Mike Johnson', score: 78, skills: ['React', 'JavaScript', 'MongoDB'], experience: '3 years' },
];

export const ResumeResults: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const { jobs } = useJobs();

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
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.role}</h3>
                    <div className="flex items-center text-sm text-gray-500 space-x-3">
                      <span className="flex items-center">
                        <BriefcaseIcon className="w-4 h-4 mr-1" />
                        {job.experience}
                      </span>
                      <span>•</span>
                      <span>Created {job.dateCreated}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-2 font-medium">
                    {mockCandidates.length} candidates analyzed
                  </Badge>
                  <Badge className={`${
                    job.status === 'Active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  } border`}>
                    {job.status}
                  </Badge>
                </div>
              </button>

              {expandedJob === job.id && (
                <div className="border-t border-gray-100 bg-gray-50/30">
                  <CardContent className="p-6 space-y-4">
                    {mockCandidates.map((candidate, index) => (
                      <Card key={index} className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-11 w-11">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm">
                                  {candidate.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-semibold text-gray-900 text-lg">{candidate.name}</h4>
                                <p className="text-sm text-gray-600 flex items-center mt-1">
                                  <StarIcon className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                                  {candidate.experience} experience
                                </p>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 ${getScoreColor(candidate.score)}`}>
                                <div>
                                  <div className="text-xl font-bold">{candidate.score}%</div>
                                  <div className="text-xs font-medium -mt-1">Match</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mb-5">
                            <div className="flex items-center mb-3">
                              <div className={`w-2 h-2 rounded-full mr-2 ${getScoreBadgeColor(candidate.score)}`}></div>
                              <h5 className="text-sm font-semibold text-gray-700">Key Skills</h5>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {candidate.skills.map((skill, skillIndex) => (
                                <Badge key={skillIndex} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-xs font-medium">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm">
                              Send Interview Link
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
