import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = 'https://ulrvgfvnysfqjykwfvfm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscnZnZnZueXNmcWp5a3dmdmZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMjYyMjYsImV4cCI6MjA2MzYwMjIyNn0.4UELfVEzDLR1iWk3b4386Ng53N49LFbfGiY3FwfGWYk';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using authentication for now
  },
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('job_posts').select('count');
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}; 