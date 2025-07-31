import React, { useState, useEffect } from 'react';
import { ResumeScreeningApi, InterviewSetupInput } from '../lib/api';
import { toast } from 'sonner';

interface InterviewConfigProps {
  jobId: string | null;
  onPrev: () => void;
  onComplete: () => void;
}

const defaultWeightages = {
  Tech: {
    Entry: { screening: 20, domain: 50, behavioral: 30 },
    Mid: { screening: 15, domain: 60, behavioral: 25 },
    Senior: { screening: 10, domain: 65, behavioral: 25 },
  },
  'Semi-Tech': {
    Entry: { screening: 25, domain: 45, behavioral: 30 },
    Mid: { screening: 20, domain: 55, behavioral: 25 },
    Senior: { screening: 15, domain: 60, behavioral: 25 },
  },
  'Non-Tech': {
    Entry: { screening: 30, domain: 35, behavioral: 35 },
    Mid: { screening: 25, domain: 45, behavioral: 30 },
    Senior: { screening: 20, domain: 50, behavioral: 30 },
  },
};

type RoleType = keyof typeof defaultWeightages;
type Level = keyof typeof defaultWeightages['Tech'];

interface ConfigurationState {
  roleType: RoleType;
  level: Level;
  weightages: {
    screening: number;
    domain: number;
    behavioral: number;
  };
  numberOfQuestions: number;
  estimatedDuration: number;
  fixedQuestions: boolean;
  enabled: boolean;
  questionTemplate: string; // Optional template or prompt for question generation
}

// Question configuration options
const questionOptions = [
  { value: 7, label: '20 min interview', duration: 20 },
];

export const InterviewConfig: React.FC<InterviewConfigProps> = ({ jobId, onPrev, onComplete }) => {
  const [globalConfig, setGlobalConfig] = useState({
    previewEnabled: true,
  });

  // Initialize configurations for all possible combinations
  const [configurations, setConfigurations] = useState<ConfigurationState[]>(() => {
    const configs: ConfigurationState[] = [];
    Object.keys(defaultWeightages).forEach((roleType) => {
      Object.keys(defaultWeightages[roleType as RoleType]).forEach((level) => {
        configs.push({
          roleType: roleType as RoleType,
          level: level as Level,
          weightages: defaultWeightages[roleType as RoleType][level as Level],
          numberOfQuestions: 7,
          estimatedDuration: 10,
          fixedQuestions: false,
          enabled: true, // Start with all enabled by default
          questionTemplate: '', // Initialize with empty string
        });
      });
    });
    return configs;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load existing interview setups when component mounts
  useEffect(() => {
    const loadExistingSetups = async () => {
      if (!jobId) {
        setIsLoadingData(false);
        return;
      }

      try {
        setIsLoadingData(true);
        console.log('Loading existing interview setups for job:', jobId);
        
        // First verify the job exists before trying to load interview setups
        try {
          const jobResponse = await fetch(`/api/jobs/${jobId}`);
          if (!jobResponse.ok) {
            console.error('Job not found:', jobId);
            toast.error('Job not found. Please create a new job.');
            setIsLoadingData(false);
            return;
          }
        } catch (jobError) {
          console.error('Error checking job existence:', jobError);
          toast.error('Unable to verify job. Please try again.');
          setIsLoadingData(false);
          return;
        }
        
        const response = await ResumeScreeningApi.getInterviewSetup(jobId);
        
        if (response.status === 'success' && response.data.length > 0) {
          console.log('Found existing setups:', response.data);
          
          // Update configurations state with existing data
          setConfigurations(prevConfigs => {
            const updatedConfigs = [...prevConfigs];
            
            // First, disable all configurations since we have existing setups
            updatedConfigs.forEach(config => {
              config.enabled = false;
            });
            
            // Then enable and update only the configurations that exist in database
            response.data.forEach((existingSetup) => {
              // Map database format to frontend format
              const roleTypeMap: { [key: string]: RoleType } = {
                'tech': 'Tech',
                'semi-tech': 'Semi-Tech',
                'non-tech': 'Non-Tech'
              };
              
              const levelMap: { [key: string]: Level } = {
                'entry': 'Entry',
                'mid': 'Mid',
                'senior': 'Senior'
              };
              
              const roleType = roleTypeMap[existingSetup.role_type] || 'Tech';
              const level = levelMap[existingSetup.level] || 'Entry';
              
              const configIndex = updatedConfigs.findIndex(
                c => c.roleType === roleType && c.level === level
              );
              
              if (configIndex >= 0) {
                updatedConfigs[configIndex] = {
                  roleType,
                  level,
                  weightages: {
                    screening: existingSetup.screening_percentage,
                    domain: existingSetup.domain_percentage,
                    behavioral: existingSetup.behavioral_attitude_percentage,
                  },
                  numberOfQuestions: existingSetup.number_of_questions || 7,
                  estimatedDuration: existingSetup.estimated_duration || 10,
                  fixedQuestions: existingSetup.fixed_questions_mode || false,
                  enabled: true, // Enable configurations that exist in database
                  questionTemplate: existingSetup.question_template || '', // Update questionTemplate
                };
              }
            });
            
            return updatedConfigs;
          });
          
          toast.success(`Loaded ${response.data.length} existing interview configurations`);
        } else {
          console.log('No existing interview setups found for job:', jobId);
          console.log('All configurations will remain enabled by default');
          // No existing setups - keep all configurations enabled by default (no action needed)
        }
      } catch (error) {
        console.error('Error loading existing interview setups:', error);
        toast.error('Failed to load existing interview configurations');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadExistingSetups();
  }, [jobId]);

  const getConfigIndex = (roleType: RoleType, level: Level) => {
    return configurations.findIndex(c => c.roleType === roleType && c.level === level);
  };

  const updateConfiguration = (roleType: RoleType, level: Level, updates: Partial<ConfigurationState>) => {
    const index = getConfigIndex(roleType, level);
    if (index >= 0) {
      const newConfigurations = [...configurations];
      
      // If updating numberOfQuestions, also update estimatedDuration
      if (updates.numberOfQuestions !== undefined) {
        const questionOption = questionOptions.find(opt => opt.value === updates.numberOfQuestions);
        if (questionOption) {
          updates.estimatedDuration = questionOption.duration;
        }
      }
      
      newConfigurations[index] = { ...newConfigurations[index], ...updates };
      setConfigurations(newConfigurations);
    }
  };

  const toggleConfiguration = (roleType: RoleType, level: Level) => {
    updateConfiguration(roleType, level, { 
      enabled: !configurations[getConfigIndex(roleType, level)]?.enabled 
    });
  };

  const updateWeightage = (roleType: RoleType, level: Level, category: keyof ConfigurationState['weightages'], value: number) => {
    const config = configurations[getConfigIndex(roleType, level)];
    if (config) {
      const newWeightages = { ...config.weightages, [category]: value };
      updateConfiguration(roleType, level, { weightages: newWeightages });
    }
  };

  const getExperienceRange = (level: Level): string => {
    switch (level) {
      case 'Entry': return '0-2 years';
      case 'Mid': return '2-6 years';
      case 'Senior': return '6+ years';
      default: return '0-2 years';
    }
  };

  const handleSaveInterviewSetup = async () => {
    if (!jobId) {
      toast.error('Job ID is missing. Please go back and create the job first.');
      return;
    }

    const enabledConfigurations = configurations.filter(config => config.enabled);
    
    if (enabledConfigurations.length === 0) {
      toast.error('Please enable at least one role type and seniority level combination.');
      return;
    }

    // Validate that all enabled configurations have percentages that sum to 100
    for (const config of enabledConfigurations) {
      const total = Object.values(config.weightages).reduce((sum, val) => sum + val, 0);
      if (total !== 100) {
        toast.error(`Percentages for ${config.roleType}-${config.level} must total exactly 100% (currently ${total}%)`);
        return;
      }
    }

    setIsLoading(true);
    
    try {
      // Map frontend data to backend API format
      const apiConfigurations: InterviewSetupInput[] = enabledConfigurations.map(config => ({
        role_type: config.roleType.toLowerCase().replace('-', '-') as 'tech' | 'non-tech' | 'semi-tech',
        level: config.level.toLowerCase() as 'entry' | 'mid' | 'senior',
        experience_range: getExperienceRange(config.level),
        screening_percentage: config.weightages.screening,
        domain_percentage: config.weightages.domain,
        behavioral_attitude_percentage: config.weightages.behavioral,
        communication_percentage: 0, // Set to 0 - communication assessed through responses, not separate questions
        number_of_questions: config.numberOfQuestions,
        estimated_duration: config.estimatedDuration,
        fixed_questions_mode: config.fixedQuestions,
        question_template: config.questionTemplate,
      }));

      console.log('Saving multiple interview setups:', apiConfigurations);
      
      const response = await ResumeScreeningApi.createInterviewSetupWithConfigurations(
        jobId, 
        apiConfigurations, 
        true // Replace all existing configurations
      );
      
      if (response.status === 'success') {
        toast.success(`Successfully saved ${apiConfigurations.length} interview setup configurations!`);
        onComplete();
      } else {
        throw new Error('Failed to save interview setups');
      }
    } catch (error) {
      console.error('Error saving interview setups:', error);
      toast.error('Failed to save interview setups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const enabledConfigurations = configurations.filter(config => config.enabled);

  // Convenience functions for select/deselect all
  const selectAllConfigurations = () => {
    setConfigurations(prevConfigs => 
      prevConfigs.map(config => ({ ...config, enabled: true }))
    );
    toast.success('All configurations enabled');
  };

  const deselectAllConfigurations = () => {
    setConfigurations(prevConfigs => 
      prevConfigs.map(config => ({ ...config, enabled: false }))
    );
    toast.info('All configurations disabled');
  };

  // Show loading state while fetching existing data
  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3 mb-4"></div>
            <div className="h-10 bg-gray-300 rounded w-1/4"></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/2 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="h-6 bg-gray-300 rounded mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Setup Configuration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select and configure interview setups for different role types and seniority levels. 
          All combinations are enabled by default - you can disable any that you don't need.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="previewEnabled"
              checked={globalConfig.previewEnabled}
              onChange={(e) => setGlobalConfig({ ...globalConfig, previewEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="previewEnabled" className="text-sm font-medium text-gray-700">
              Enable Question Preview
            </label>
          </div>
        </div>
      </div>

      {/* Configuration Matrix */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Role & Level Configurations ({enabledConfigurations.length} enabled)
          </h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={selectAllConfigurations}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAllConfigurations}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {configurations.map((config) => {
            const total = Object.values(config.weightages).reduce((sum, val) => sum + val, 0);
            const isValid = total === 100;
            
            return (
              <div
                key={`${config.roleType}-${config.level}`}
                className={`border rounded-lg p-4 transition-all ${
                  config.enabled 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Header with enable toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`enable-${config.roleType}-${config.level}`}
                      checked={config.enabled}
                      onChange={() => toggleConfiguration(config.roleType, config.level)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label 
                      htmlFor={`enable-${config.roleType}-${config.level}`}
                      className="font-medium text-gray-900"
                    >
                      {config.roleType} - {config.level}
                    </label>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {total}%
                  </span>
                </div>

                {/* Configuration details (only show if enabled) */}
                {config.enabled && (
                  <div className="space-y-4">
                    {/* Questions and Duration */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Number of Questions
                        </label>
                        <select
                          value={config.numberOfQuestions}
                          onChange={(e) => updateConfiguration(config.roleType, config.level, { 
                            numberOfQuestions: parseInt(e.target.value) || 7 
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        >
                          {questionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-xs text-gray-500">
                          Estimated Duration: {config.estimatedDuration} minutes
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`fixed-${config.roleType}-${config.level}`}
                          checked={config.fixedQuestions}
                          onChange={(e) => updateConfiguration(config.roleType, config.level, { 
                            fixedQuestions: e.target.checked 
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label 
                          htmlFor={`fixed-${config.roleType}-${config.level}`}
                          className="text-xs font-medium text-gray-700"
                        >
                          Fixed Questions Mode
                        </label>
                      </div>
                    </div>

                    {/* Weightage Sliders */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">Category Weightages:</div>
                      {Object.entries(config.weightages).map(([category, value]) => (
                        <div key={category}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-gray-600 capitalize">
                              {category === 'behavioral' ? 'Behavioral' : category}
                            </label>
                            <span className="text-xs text-gray-600">{value}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) => updateWeightage(
                              config.roleType, 
                              config.level, 
                              category as keyof ConfigurationState['weightages'], 
                              parseInt(e.target.value)
                            )}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Question Template Description Box */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Custom Question Template <span className="text-gray-500">(Optional)</span>
                      </label>
                      <textarea
                        value={config.questionTemplate}
                        onChange={(e) => updateConfiguration(config.roleType, config.level, { 
                          questionTemplate: e.target.value 
                        })}
                        placeholder={`Provide specific instructions or templates for ${config.roleType} ${config.level} questions...

Example: "Focus on React hooks, state management, and component optimization. Ask about real-world debugging scenarios."`}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={4}
                      />
                      <div className="text-xs text-gray-500">
                        AI will use this template to generate more targeted questions for this role and level combination.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleSaveInterviewSetup}
          disabled={enabledConfigurations.length === 0 || enabledConfigurations.some(config => 
            Object.values(config.weightages).reduce((sum, val) => sum + val, 0) !== 100
          ) || isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          <span>{isLoading ? 'Saving...' : 'Create Job'}</span>
        </button>
      </div>
    </div>
  );
};
