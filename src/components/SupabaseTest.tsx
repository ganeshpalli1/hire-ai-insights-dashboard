import React, { useEffect, useState } from 'react';
import { testSupabaseConnection } from '../lib/supabase';
import { useInterviewSetups, useJobs } from '../hooks';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { CheckCircleIcon, XCircleIcon, RefreshCcwIcon } from 'lucide-react';
import { toast } from 'sonner';

export function SupabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  
  const { data: interviewSetups, isLoading: interviewLoading, error: interviewError } = useInterviewSetups();
  const { data: jobs, isLoading: jobsLoading, error: jobsError } = useJobs();

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const isConnected = await testSupabaseConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
      if (isConnected) {
        toast.success('Supabase connection successful!');
      } else {
        toast.error('Supabase connection failed!');
      }
    } catch (error) {
      setConnectionStatus('failed');
      toast.error('Supabase connection error!');
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'testing':
        return <RefreshCcwIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <RefreshCcwIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Failed';
      case 'testing':
        return 'Testing...';
      default:
        return 'Not tested';
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="font-medium">Supabase Connection: {getStatusText()}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
          >
            Test Connection
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Interview Setups</h3>
          {interviewLoading ? (
            <p className="text-gray-500">Loading interview setups...</p>
          ) : interviewError ? (
            <p className="text-red-500">Error: {interviewError.message}</p>
          ) : interviewSetups ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Found {interviewSetups.length} interview configurations
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {interviewSetups.map((setup) => (
                  <div key={setup.id} className="text-xs bg-gray-50 p-2 rounded">
                    <span className="font-medium capitalize">{setup.role_type}</span> - 
                    <span className="capitalize"> {setup.level}</span>
                    <div className="text-gray-500">
                      S:{setup.screening_percentage}% D:{setup.domain_percentage}% 
                      B:{setup.behavioral_attitude_percentage}% C:{setup.communication_percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No interview setups found</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Job Posts</h3>
          {jobsLoading ? (
            <p className="text-gray-500">Loading jobs...</p>
          ) : jobsError ? (
            <p className="text-red-500">Error: {jobsError.message}</p>
          ) : jobs ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Found {jobs.length} job posts
              </p>
              {jobs.length > 0 ? (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium">{job.job_role}</span>
                      <div className="text-gray-500">
                        {job.required_experience} - {job.status}
                      </div>
                    </div>
                  ))}
                  {jobs.length > 5 && (
                    <p className="text-xs text-gray-500">...and {jobs.length - 5} more</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No jobs yet - create your first job post!</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No jobs found</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Database Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Project ID:</span>
            <p className="text-gray-600">ulrvgfvnysfqjykwfvfm</p>
          </div>
          <div>
            <span className="font-medium">Region:</span>
            <p className="text-gray-600">ap-south-1</p>
          </div>
          <div>
            <span className="font-medium">Tables:</span>
            <p className="text-gray-600">job_posts, resume_results, interview_setup</p>
          </div>
          <div>
            <span className="font-medium">Status:</span>
            <p className="text-gray-600">Production Ready</p>
          </div>
        </div>
      </Card>
    </div>
  );
} 