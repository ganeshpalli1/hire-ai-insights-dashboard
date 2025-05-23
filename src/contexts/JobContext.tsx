
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Job {
  id: string;
  role: string;
  experience: string;
  description: string;
  dateCreated: string;
  status: 'Active' | 'Draft';
  applicants: number;
}

interface JobContextType {
  jobs: Job[];
  addJob: (jobData: any) => void;
  getJob: (id: string) => Job | undefined;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);

  const addJob = (jobData: any) => {
    const newJob: Job = {
      id: Date.now().toString(),
      role: jobData.role,
      experience: jobData.experience,
      description: jobData.description,
      dateCreated: new Date().toISOString().split('T')[0],
      status: 'Active',
      applicants: Math.floor(Math.random() * 15), // Simulated for now
    };
    setJobs(prev => [...prev, newJob]);
  };

  const getJob = (id: string) => {
    return jobs.find(job => job.id === id);
  };

  return (
    <JobContext.Provider value={{ jobs, addJob, getJob }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};
