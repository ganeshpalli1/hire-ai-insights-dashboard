
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NewJob } from "./pages/NewJob";
import { JobPosts } from "./pages/JobPosts";
import { ResumeResults } from "./pages/ResumeResults";
import { InterviewResults } from "./pages/InterviewResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<NewJob />} />
            <Route path="/job-posts" element={<JobPosts />} />
            <Route path="/resume-results" element={<ResumeResults />} />
            <Route path="/interview-results" element={<InterviewResults />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
