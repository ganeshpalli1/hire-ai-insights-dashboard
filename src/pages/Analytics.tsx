import React from 'react';
import { PageHeader } from '../components/PageHeader';

export const Analytics: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Analytics" 
        subtitle="Recruitment insights and performance metrics"
      />
      
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
          <p className="text-gray-600">Advanced analytics and reporting coming soon.</p>
        </div>
      </div>
    </div>
  );
}; 