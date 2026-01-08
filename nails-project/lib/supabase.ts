import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase Config Check:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'ג“ Set' : 'ג— Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'ג“ Set' : 'ג— Missing');
}

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  const errorMessage = `Missing Supabase environment variables: ${missingVars.join(', ')}. Please check your .env.local file in the project root (${process.cwd()}) and ensure it contains: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Also make sure to restart your Next.js dev server after adding environment variables.`;
  
  console.error(errorMessage);
  console.error('Current working directory:', process.cwd());
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')).join(', ') || 'None found');
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Booking {
  id?: string;
  service_id: string;
  service_title: string;
  service_duration: number;
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  cancellation_token?: string;
  status?: string;
  is_verified?: boolean;
  verification_code?: string;
  created_at?: string;
}

export interface BlockedDate {
  id?: string;
  date: string;
  created_at?: string;
}

export interface BlockedTimeSlot {
  id?: string;
  date: string; // Format: "YYYY-MM-DD"
  start_time: string; // Format: "HH:MM"
  end_time: string; // Format: "HH:MM"
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  created_at: string;
  type: string;
  description: string;
}

// Shared function to log activities to activity_log table
export const logActivity = async (type: string, description: string) => {
  const { error } = await supabase
    .from('activity_log')
    .insert([{ type, description }]);
  if (error) console.error('Error logging activity:', error);
};
