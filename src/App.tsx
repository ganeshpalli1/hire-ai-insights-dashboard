import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { JobProvider } from './contexts/JobContext';
import { Dashboard } from './pages/Dashboard';
import { NewJob } from './pages/NewJob';
import { JobPosts } from './pages/JobPosts';
import { ResumeResults } from './pages/ResumeResults';
import { InterviewResults } from './pages/InterviewResults';
import { Candidates } from './pages/Candidates';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { VideoInterview } from './pages/VideoInterview';
import { UploadProgress } from './pages/UploadProgress';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Component to conditionally render with or without Layout
const AppContent: React.FC = () => {
  const location = useLocation();
  
  // Routes that should not have the navbar/sidebar
  const noLayoutRoutes = ['/videointerview', '/video-interview', '/upload-progress'];
  const shouldHideLayout = noLayoutRoutes.includes(location.pathname);

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/new-job" element={<NewJob />} />
      <Route path="/job-posts" element={<JobPosts />} />
      <Route path="/resume-results" element={<ResumeResults />} />
      <Route path="/interview-results" element={<InterviewResults />} />
      <Route path="/candidates" element={<Candidates />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/videointerview" element={<VideoInterview />} />
      <Route path="/video-interview" element={<VideoInterview />} />
      <Route path="/upload-progress" element={<UploadProgress />} />
    </Routes>
  );

  return shouldHideLayout ? routes : <Layout>{routes}</Layout>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <JobProvider>
          <AppContent />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'white',
                border: '1px solid #e5e7eb',
                color: '#374151',
              },
            }}
          />
        </JobProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
