import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BriefcaseIcon, 
  DocumentTextIcon, 
  UsersIcon, 
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, path: '/dashboard' },
  { id: 'new-job', label: 'New Job', icon: PlusIcon, path: '/new-job' },
  { id: 'job-posts', label: 'All Job Posts', icon: BriefcaseIcon, path: '/job-posts' },
  { id: 'resume-results', label: 'Resume Results', icon: DocumentTextIcon, path: '/resume-results' },
  { id: 'interview-results', label: 'Interview Results', icon: ChatBubbleLeftRightIcon, path: '/interview-results' },
];

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className={`bg-gradient-to-br from-blue-900 to-blue-800 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent">
              RecruitAI Pro
            </h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-5 h-5" />
            ) : (
              <ChevronLeftIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 shadow-lg'
                    : 'hover:bg-blue-700 hover:shadow-md'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
