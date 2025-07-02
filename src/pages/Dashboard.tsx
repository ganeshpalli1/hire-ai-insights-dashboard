import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useJobs } from '../contexts/JobContext';
import { Card, CardContent } from '../components/ui/card';
import { UsersIcon, BriefcaseIcon, ChartBarIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline';

export const Dashboard: React.FC = () => {
  const { jobs, isLoadingInitialData } = useJobs();
  const navigate = useNavigate();

  const stats = [
    {
      name: 'Total Jobs',
      value: jobs.length,
      icon: BriefcaseIcon,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      name: 'Active Jobs',
      value: jobs.filter(job => job.status === 'Active').length,
      icon: ChartBarIcon,
      color: 'text-green-600 bg-green-50',
    },
    {
      name: 'Total Candidates',
      value: jobs.reduce((acc, job) => acc + job.applicants, 0),
      icon: UsersIcon,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      name: 'Processing',
      value: jobs.filter(job => job.status === 'Processing').length,
      icon: ClockIcon,
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  if (isLoadingInitialData) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-300 rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-gray-300 rounded w-1/3 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-300 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-gray-300 rounded w-1/3 mb-6"></div>
              <div className="h-32 bg-gray-300 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Dashboard" 
        subtitle="AI-powered recruitment analytics and insights"
        action={
          <button
            onClick={() => navigate('/new-job')}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            <span>New Job</span>
          </button>
        }
      />
      
      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.name} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Jobs */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h3>
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <BriefcaseIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No jobs created yet</h4>
                <p className="text-gray-600 mb-6">Create your first job to start AI-powered recruitment.</p>
                <button
                  onClick={() => navigate('/new-job')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center space-x-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Create Your First Job</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{job.job_role}</h4>
                      <p className="text-sm text-gray-600">{job.required_experience} • Created {job.dateCreated}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">{job.applicants} candidates</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        job.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : job.status === 'Processing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 