import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { JobDetailsForm } from '../components/JobDetailsForm';
import { AIAnalysis } from '../components/AIAnalysis';
import { InterviewConfig } from '../components/InterviewConfig';
import { useJobs } from '../contexts/JobContext';
import { toast } from 'sonner';
import { JobDescriptionInput } from '../lib/api';

const steps = [
  { id: 1, name: 'Job Details', description: 'Enter job requirements' },
  { id: 2, name: 'AI Analysis', description: 'Review AI insights and upload resumes' },
  { id: 3, name: 'Interview Setup', description: 'Configure AI interview parameters' },
];

export const NewJob: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobData, setJobData] = useState({
    role: '',
    experience: '',
    description: '',
  });
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const { createJob } = useJobs();
  const navigate = useNavigate();

  const nextStep = () => setCurrentStep(Math.min(currentStep + 1, 3));
  const prevStep = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const handleJobDetailsNext = async () => {
    if (!jobData.role || !jobData.experience || !jobData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreatingJob(true);
    try {
      // Transform the data to match API structure
      const apiJobData: JobDescriptionInput = {
        job_role: jobData.role,
        required_experience: jobData.experience,
        description: jobData.description,
      };

      const jobId = await createJob(apiJobData);
      setCreatedJobId(jobId);
      nextStep();
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create job. Please try again.');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleJobCreation = () => {
    toast.success('Job setup completed successfully!', {
      description: `${jobData.role} is ready for candidate screening.`,
    });
    
    // Reset form and redirect
    setTimeout(() => {
      navigate('/job-posts');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Create New Job" 
        subtitle="Set up a new position and configure AI-powered recruitment"
      />
      
      <div className="p-6 max-w-7xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                  currentStep >= step.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                    : 'bg-white border-gray-300 text-gray-500'
                }`}>
                  {step.id}
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium transition-colors ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-24 h-0.5 mx-6 transition-all duration-300 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Job Details</h3>
                <p className="text-gray-600">
                  Provide comprehensive job information to enable accurate AI analysis and candidate matching.
                </p>
              </div>
              <JobDetailsForm
                data={jobData}
                onChange={setJobData}
                onNext={handleJobDetailsNext}
              />
              {isCreatingJob && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-blue-700">Creating job and analyzing requirements...</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {currentStep === 2 && (
            <AIAnalysis
              jobData={jobData}
              jobId={createdJobId}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 3 && (
            <InterviewConfig
              jobId={createdJobId}
              onPrev={prevStep}
              onComplete={handleJobCreation}
            />
          )}
        </div>
      </div>
    </div>
  );
};
