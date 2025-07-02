import React from 'react';
import { JobDescriptionInput } from '../lib/api.ts';

interface JobDetailsFormProps {
  data: {
    role: string;
    experience: string;
    description: string;
  };
  onChange: (data: any) => void;
  onNext: () => void;
}

export const JobDetailsForm: React.FC<JobDetailsFormProps> = ({ data, onChange, onNext }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job Role *
        </label>
        <input
          type="text"
          value={data.role}
          onChange={(e) => onChange({ ...data, role: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Senior Frontend Developer"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Experience Required *
        </label>
        <select
          value={data.experience}
          onChange={(e) => onChange({ ...data, experience: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select experience level</option>
          <option value="0-2 years">0-2 years (Entry Level)</option>
          <option value="2-6 years">2-6 years (Mid Level)</option>
          <option value="6+ years">6+ years (Senior Level)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job Description *
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Describe the role, responsibilities, requirements, and qualifications..."
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          Provide a detailed description including required skills, experience, responsibilities, and qualifications.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={!data.role || !data.experience || !data.description}
        >
          Continue to AI Analysis
        </button>
      </div>
    </form>
  );
};
