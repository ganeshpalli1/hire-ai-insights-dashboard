
import React, { useState } from 'react';

interface InterviewConfigProps {
  onPrev: () => void;
  onComplete: () => void;
}

const defaultWeightages = {
  'Non-Tech': {
    'Entry': { screening: 30, domain: 0, behavioral: 50, communication: 20 },
    'Mid': { screening: 25, domain: 0, behavioral: 55, communication: 20 },
    'Senior': { screening: 20, domain: 0, behavioral: 60, communication: 20 },
  },
  'Semi-Tech': {
    'Entry': { screening: 20, domain: 25, behavioral: 40, communication: 15 },
    'Mid': { screening: 15, domain: 30, behavioral: 40, communication: 15 },
    'Senior': { screening: 10, domain: 35, behavioral: 45, communication: 10 },
  },
  'Tech': {
    'Entry': { screening: 15, domain: 40, behavioral: 35, communication: 10 },
    'Mid': { screening: 10, domain: 45, behavioral: 35, communication: 10 },
    'Senior': { screening: 5, domain: 50, behavioral: 35, communication: 10 },
  },
};

export const InterviewConfig: React.FC<InterviewConfigProps> = ({ onPrev, onComplete }) => {
  const [config, setConfig] = useState({
    fixedQuestions: false,
    duration: 30,
    previewEnabled: true,
    roleType: 'Tech' as keyof typeof defaultWeightages,
    level: 'Mid' as keyof typeof defaultWeightages['Tech'],
  });

  const [weightages, setWeightages] = useState(defaultWeightages.Tech.Mid);

  const handleRoleTypeChange = (roleType: keyof typeof defaultWeightages) => {
    setConfig({ ...config, roleType });
    setWeightages(defaultWeightages[roleType][config.level]);
  };

  const handleLevelChange = (level: keyof typeof defaultWeightages['Tech']) => {
    setConfig({ ...config, level });
    setWeightages(defaultWeightages[config.roleType][level]);
  };

  const handleWeightageChange = (category: keyof typeof weightages, value: number) => {
    setWeightages({ ...weightages, [category]: value });
  };

  const total = Object.values(weightages).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="fixedQuestions"
              checked={config.fixedQuestions}
              onChange={(e) => setConfig({ ...config, fixedQuestions: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="fixedQuestions" className="text-sm font-medium text-gray-700">
              Fixed Questions Mode
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={config.duration}
              onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="previewEnabled"
              checked={config.previewEnabled}
              onChange={(e) => setConfig({ ...config, previewEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="previewEnabled" className="text-sm font-medium text-gray-700">
              Enable Question Preview
            </label>
          </div>
        </div>
      </div>

      {/* Category Weightage Configuration */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Weightage Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role Type</label>
            <select
              value={config.roleType}
              onChange={(e) => handleRoleTypeChange(e.target.value as keyof typeof defaultWeightages)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Tech">Tech</option>
              <option value="Semi-Tech">Semi-Tech</option>
              <option value="Non-Tech">Non-Tech</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Seniority Level</label>
            <select
              value={config.level}
              onChange={(e) => handleLevelChange(e.target.value as keyof typeof defaultWeightages['Tech'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Entry">Entry (0-2 years)</option>
              <option value="Mid">Mid (2-6 years)</option>
              <option value="Senior">Senior (6+ years)</option>
            </select>
          </div>
        </div>

        {/* Weightage Sliders */}
        <div className="space-y-4">
          {Object.entries(weightages).map(([category, value]) => (
            <div key={category}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700 capitalize">
                  {category === 'behavioral' ? 'Behavioral + Attitude' : category}
                </label>
                <span className="text-sm text-gray-600">{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => handleWeightageChange(category as keyof typeof weightages, parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          ))}
          
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className={`text-sm font-semibold ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
                {total}%
              </span>
            </div>
          </div>
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
          onClick={onComplete}
          disabled={total !== 100}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Job
        </button>
      </div>
    </div>
  );
};
